const router = require('express').Router();
const Trek = require('../models/Trek');
const Booking = require('../models/Booking');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Dashboard numbers: revenue, seats, occupancy per trek, and batches that are nearly full
router.get('/stats', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const [treks, sums] = await Promise.all([Trek.find().lean(), Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: '$trek', revenue: { $sum: '$totalPrice' }, seats: { $sum: '$seats' }, bookings: { $sum: 1 } } }])]);
    const by = Object.fromEntries(sums.map(s => [String(s._id), s]));
    const now = new Date(); const alerts = [];
    const rows = treks.map(t => {
      const cap = t.batches.reduce((a, b) => a + b.capacity, 0), left = t.batches.reduce((a, b) => a + b.seatsLeft, 0);
      t.batches.forEach(b => { if (b.startDate > now && b.seatsLeft <= 3) alerts.push({ trek: t.name, startDate: b.startDate, seatsLeft: b.seatsLeft }); });
      const s = by[String(t._id)] || {};
      return { id: t._id, name: t.name, revenue: s.revenue || 0, seats: s.seats || 0, bookings: s.bookings || 0,
        occupancy: cap ? Math.round((cap - left) / cap * 100) : 0 };
    }).sort((a, b) => b.revenue - a.revenue);
    const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
    res.json({ totals: { revenue: sum('revenue'), bookings: sum('bookings'), seats: sum('seats') }, treks: rows, alerts });
  } catch (e) { next(e); }
});
module.exports = router;
