const router = require('express').Router();
const mongoose = require('mongoose');
const { z } = require('zod');
const Trek = require('../models/Trek');
const Booking = require('../models/Booking');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Recommendation logic: how well a trek fits a trekker's experience.
function fitFor(trek, experience) {
  if (!experience) return null;
  let risk = trek.difficulty - experience;
  if (trek.maxAltitude > 4500 && experience < 3) risk += 1;
  if (trek.days > 7 && experience < 2) risk += 1;
  return risk <= 0 ? 'good' : risk === 1 ? 'stretch' : 'too-hard';
}
const nextOpen = (t) => (t.batches || []).filter(b => b.startDate > new Date() && b.seatsLeft > 0).length;

// Auto-build a day-by-day altitude plan so every trek gets an elevation chart
function makeItinerary(days, maxAltitude) {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    title: i === days - 1 ? 'Descent and departure' : i === days - 2 ? 'Summit day' : 'Trek day ' + (i + 1),
    altitude: Math.round(maxAltitude * (i === days - 1 ? 0.45 : 0.45 + 0.55 * Math.min(1, i / Math.max(1, days - 2))) / 50) * 50,
  }));
}
const badId = (res, what = 'Trek') => res.status(404).json({ error: `${what} not found.` });

router.get('/', async (req, res, next) => {
  try {
    const { q, region, difficulty, season, maxDays, maxPrice, onlyAvailable, experience } = req.query;
    const f = {};
    if (q) f.$text = { $search: String(q) };
    if (region) f.region = String(region);
    if (difficulty) f.difficulty = Number(difficulty);
    if (season) f.season = String(season);
    if (maxDays) f.days = { $lte: Number(maxDays) };
    if (maxPrice) f.pricePerPerson = { $lte: Number(maxPrice) };
    let treks = await Trek.find(f).sort({ difficulty: 1, name: 1 }).lean();
    if (onlyAvailable === 'true') treks = treks.filter(nextOpen);
    const exp = Number(experience) || null;
    res.json(treks.map(t => ({ ...t, openBatches: nextOpen(t), fit: fitFor(t, exp) })));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const t = await Trek.findById(req.params.id).lean();
    if (!t) return badId(res);
    t.batches = t.batches.filter(b => b.startDate > new Date()).sort((a, b) => a.startDate - b.startDate);
    res.json(t);
  } catch (e) { next(e); }
});

const trekSchema = z.object({
  name: z.string().min(2), region: z.string().min(2), difficulty: z.number().int().min(1).max(3),
  days: z.number().int().min(1), maxAltitude: z.number().min(0), pricePerPerson: z.number().min(0),
  season: z.array(z.enum(['winter', 'spring', 'summer', 'monsoon', 'autumn'])).default([]),
  description: z.string().optional(),
});
const firstError = (p) => p.error.issues[0].path.join('.') + ': ' + p.error.issues[0].message;

// ---- Admin: add trek ----
router.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const p = trekSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: firstError(p) });
    res.status(201).json(await Trek.create({ ...p.data, itinerary: makeItinerary(p.data.days, p.data.maxAltitude) }));
  } catch (e) { next(e); }
});

// ---- Admin: edit trek (batches are not touched) ----
router.put('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const p = trekSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: firstError(p) });
    const t = await Trek.findByIdAndUpdate(req.params.id,
      { ...p.data, itinerary: makeItinerary(p.data.days, p.data.maxAltitude) }, { new: true });
    if (!t) return badId(res);
    res.json(t);
  } catch (e) { next(e); }
});

// ---- Admin: delete trek (blocked while upcoming held or confirmed bookings exist) ----
router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const active = await Booking.countDocuments({ trek: req.params.id, active: true, startDate: { $gt: new Date() } });
    if (active > 0)
      return res.status(409).json({ error: `Cannot delete: ${active} upcoming booking(s) exist. Ask those trekkers to cancel first.` });
    const t = await Trek.findByIdAndDelete(req.params.id);
    if (!t) return badId(res);
    await Booking.deleteMany({ trek: req.params.id }); // only cancelled, expired or past bookings remain at this point
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Admin: add batch ----
router.post('/:id/batches', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const p = z.object({ startDate: z.coerce.date(), capacity: z.number().int().min(1).max(60) }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Provide a valid start date and capacity (1-60).' });
    if (p.data.startDate <= new Date()) return res.status(400).json({ error: 'Start date must be in the future.' });
    if (!mongoose.isValidObjectId(req.params.id)) return badId(res);
    const t = await Trek.findByIdAndUpdate(req.params.id,
      { $push: { batches: { startDate: p.data.startDate, capacity: p.data.capacity, seatsLeft: p.data.capacity } } }, { new: true });
    if (!t) return badId(res);
    res.status(201).json(t);
  } catch (e) { next(e); }
});

// ---- Admin: delete batch (blocked while it has held or confirmed bookings) ----
router.delete('/:id/batches/:batchId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id, batchId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(batchId)) return badId(res, 'Batch');
    if (await Booking.exists({ trek: id, batchId, active: true }))
      return res.status(409).json({ error: 'Cannot delete: this batch has active bookings.' });
    const r = await Trek.updateOne({ _id: id }, { $pull: { batches: { _id: batchId } } });
    if (!r.modifiedCount) return badId(res, 'Batch');
    res.json({ ok: true });
  } catch (e) { next(e); }
});
module.exports = router;