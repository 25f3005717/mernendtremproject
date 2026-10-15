const router = require('express').Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const { z } = require('zod');
const Trek = require('../models/Trek');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');
const { requireAuth } = require('../middleware/auth');
const { HOLD_MS, reserveSeats, releaseSeats, promoteWaitlist, releaseExpired } = require('../services/seats');

// Packing list adapts to season, difficulty and altitude
function gearFor(t) {
  const g = ['Trekking shoes', 'Backpack (40L)', 'Rain jacket', 'Water bottle (2L)', 'Headlamp', 'First-aid kit'];
  if (t.season?.includes('winter')) g.push('Thermal layers', 'Insulated gloves', 'Gaiters');
  if (t.season?.includes('monsoon')) g.push('Waterproof pack cover');
  if (t.difficulty >= 2) g.push('Trekking poles');
  if (t.maxAltitude > 4500) g.push('Altitude acclimatisation plan', 'Sunglasses (UV)');
  return g;
}
const CANCEL_WINDOW_MS = 48 * 3600 * 1000;
const bookSchema = z.object({ trekId: z.string(), batchId: z.string(), seats: z.number().int().min(1).max(6) });
const validIds = (p) => p.success && mongoose.isValidObjectId(p.data.trekId) && mongoose.isValidObjectId(p.data.batchId);
const DUP = 'You already have a booking for this batch. Check My bookings.';

// 1) Reserve: atomically take seats and hold them for HOLD_MS until payment
router.post('/', requireAuth, async (req, res, next) => {
  const p = bookSchema.safeParse(req.body);
  if (!validIds(p)) return res.status(400).json({ error: 'Choose a batch and between 1 and 6 seats.' });
  const { trekId, batchId, seats } = p.data;
  let reserved = false;
  try {
    await releaseExpired();
    if (await Booking.exists({ user: req.user.id, batchId, active: true })) return res.status(409).json({ error: DUP });
    const trek = await reserveSeats(trekId, batchId, seats);
    if (!trek) {
      const t = await Trek.findById(trekId).lean();
      const b = t?.batches.find(x => String(x._id) === batchId);
      if (!t || !b) return res.status(404).json({ error: 'That trek batch no longer exists.' });
      if (b.startDate <= new Date()) return res.status(409).json({ error: 'This batch has already started.' });
      return res.status(409).json({ error: b.seatsLeft === 0 ? 'This batch is full. You can join the waitlist.' : `Only ${b.seatsLeft} seat(s) left in this batch.` });
    }
    reserved = true;
    const batch = trek.batches.id(batchId);
    const booking = await Booking.create({
      user: req.user.id, trek: trekId, batchId, seats, startDate: batch.startDate,
      totalPrice: seats * trek.pricePerPerson, status: 'held', holdExpiresAt: new Date(Date.now() + HOLD_MS),
    });
    res.status(201).json(booking);
  } catch (e) {
    if (reserved) await releaseSeats(trekId, batchId, seats);
    if (e.code === 11000) return res.status(409).json({ error: DUP });
    next(e);
  }
});

// 2) Pay (test-mode gateway). Replace this block with Razorpay order + signature check for real payments.
router.post('/:id/pay', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Booking not found.' });
    const b = await Booking.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, status: 'held', holdExpiresAt: { $gt: new Date() } },
      { $set: { status: 'confirmed', paidAt: new Date(), paymentRef: 'TM-' + crypto.randomBytes(5).toString('hex').toUpperCase() } },
      { new: true });
    if (b) return res.json(b);
    await releaseExpired();
    const cur = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!cur) return res.status(404).json({ error: 'Booking not found.' });
    if (cur.status === 'confirmed') return res.status(409).json({ error: 'This booking is already paid.' });
    res.status(410).json({ error: 'Your payment window ended and the seats were released. Please book again.' });
  } catch (e) { next(e); }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    await releaseExpired();
    const list = await Booking.find({ user: req.user.id }).populate('trek', 'name region days season difficulty maxAltitude').sort({ startDate: 1 }).lean();
    res.json(list.map(b => ({
      ...b, gear: b.trek ? gearFor(b.trek) : [], gearChecked: b.gearChecked || [],
      canCancel: b.status === 'held' || (b.status === 'confirmed' && new Date(b.startDate) - Date.now() > CANCEL_WINDOW_MS),
    })));
  } catch (e) { next(e); }
});

// 3) Cancel: held bookings anytime; paid bookings until 48h before start. Freed seats go to the waitlist.
router.post('/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Booking not found.' });
    const b = await Booking.findById(req.params.id);
    if (!b || String(b.user) !== req.user.id) return res.status(404).json({ error: 'Booking not found.' });
    if (!['held', 'confirmed'].includes(b.status)) return res.status(409).json({ error: 'This booking is already closed.' });
    if (b.status === 'confirmed' && b.startDate - Date.now() <= CANCEL_WINDOW_MS)
      return res.status(409).json({ error: 'Paid bookings can only be cancelled more than 48 hours before the start date.' });
    const upd = await Booking.updateOne({ _id: b._id, status: b.status }, { status: 'cancelled', active: false });
    if (upd.modifiedCount === 1) {
      await releaseSeats(b.trek, b.batchId, b.seats);
      await promoteWaitlist(b.trek, b.batchId);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Waitlist ----
router.post('/waitlist', requireAuth, async (req, res, next) => {
  const p = bookSchema.safeParse(req.body);
  if (!validIds(p)) return res.status(400).json({ error: 'Choose a batch and between 1 and 6 seats.' });
  const { trekId, batchId, seats } = p.data;
  try {
    await releaseExpired();
    const t = await Trek.findById(trekId).lean();
    const b = t?.batches.find(x => String(x._id) === batchId);
    if (!b) return res.status(404).json({ error: 'That batch no longer exists.' });
    if (b.startDate <= new Date()) return res.status(409).json({ error: 'This batch has already started.' });
    if (b.seatsLeft >= seats) return res.status(409).json({ error: 'Seats are available now. Book directly instead.' });
    if (await Booking.exists({ user: req.user.id, batchId, active: true })) return res.status(409).json({ error: DUP });
    res.status(201).json(await Waitlist.create({ user: req.user.id, trek: trekId, batchId, seats }));
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'You are already on the waitlist for this batch.' });
    next(e);
  }
});

router.get('/waitlist/mine', requireAuth, async (req, res, next) => {
  try {
    const list = await Waitlist.find({ user: req.user.id, status: 'waiting' }).populate('trek', 'name batches').lean();
    const out = [];
    for (const w of list) {
      if (!w.trek) continue;
      const b = w.trek.batches.find(x => String(x._id) === String(w.batchId));
      const ahead = await Waitlist.countDocuments({ trek: w.trek._id, batchId: w.batchId, status: 'waiting', createdAt: { $lt: w.createdAt } });
      out.push({ _id: w._id, trekName: w.trek.name, startDate: b?.startDate, seats: w.seats, position: ahead + 1 });
    }
    res.json(out);
  } catch (e) { next(e); }
});

router.delete('/waitlist/:id', requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Waitlist entry not found.' });
    const r = await Waitlist.updateOne({ _id: req.params.id, user: req.user.id, status: 'waiting' }, { status: 'left' });
    if (!r.modifiedCount) return res.status(404).json({ error: 'Waitlist entry not found.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Tick / untick a packing-list item (owner only)
router.patch('/:id/gear', requireAuth, async (req, res, next) => {
  try {
    const p = z.object({ item: z.string().max(60), checked: z.boolean() }).safeParse(req.body);
    if (!p.success || !mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid gear update.' });
    const r = await Booking.updateOne({ _id: req.params.id, user: req.user.id },
      p.data.checked ? { $addToSet: { gearChecked: p.data.item } } : { $pull: { gearChecked: p.data.item } });
    if (!r.matchedCount) return res.status(404).json({ error: 'Booking not found.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
module.exports = router;

