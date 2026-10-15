const Trek = require('../models/Trek');
const Booking = require('../models/Booking');
const Waitlist = require('../models/Waitlist');

const HOLD_MS = 10 * 60 * 1000;           // payment window for a normal booking
const WAITLIST_HOLD_MS = 30 * 60 * 1000;  // longer window when promoted from the waitlist

// Atomically take seats from an upcoming batch. Returns the trek, or null if not enough seats.
const reserveSeats = (trekId, batchId, seats) => Trek.findOneAndUpdate(
  { _id: trekId, batches: { $elemMatch: { _id: batchId, seatsLeft: { $gte: seats }, startDate: { $gt: new Date() } } } },
  { $inc: { 'batches.$.seatsLeft': -seats } }, { new: true });

const releaseSeats = (trekId, batchId, seats) =>
  Trek.updateOne({ _id: trekId, 'batches._id': batchId }, { $inc: { 'batches.$.seatsLeft': seats } });

// After seats are freed, offer them to the people waiting (oldest first)
async function promoteWaitlist(trekId, batchId) {
  const queue = await Waitlist.find({ trek: trekId, batchId, status: 'waiting' }).sort({ createdAt: 1 });
  for (const w of queue) {
    const trek = await reserveSeats(trekId, batchId, w.seats);
    if (!trek) continue; // not enough seats for this person, try the next one
    const claimed = await Waitlist.updateOne({ _id: w._id, status: 'waiting' }, { status: 'promoted' });
    if (!claimed.modifiedCount) { await releaseSeats(trekId, batchId, w.seats); continue; }
    try {
      await Booking.create({
        user: w.user, trek: trekId, batchId, seats: w.seats,
        startDate: trek.batches.id(batchId).startDate, totalPrice: w.seats * trek.pricePerPerson,
        status: 'held', holdExpiresAt: new Date(Date.now() + WAITLIST_HOLD_MS), fromWaitlist: true,
      });
    } catch (e) {
      await releaseSeats(trekId, batchId, w.seats);
      await Waitlist.updateOne({ _id: w._id }, { status: 'left' });
      console.error('Waitlist promotion failed:', e.message);
    }
  }
}

// Holds that were not paid in time: free the seats and offer them to the waitlist
async function releaseExpired() {
  const due = await Booking.find({ status: 'held', holdExpiresAt: { $lte: new Date() } }).limit(50);
  for (const b of due) {
    const r = await Booking.updateOne({ _id: b._id, status: 'held' }, { status: 'expired', active: false });
    if (!r.modifiedCount) continue; // paid or cancelled in the meantime
    await releaseSeats(b.trek, b.batchId, b.seats);
    await promoteWaitlist(b.trek, b.batchId);
  }
}
module.exports = { HOLD_MS, reserveSeats, releaseSeats, promoteWaitlist, releaseExpired };