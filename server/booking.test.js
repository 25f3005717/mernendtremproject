// Needs a local MongoDB. Run: cd server && npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const Trek = require('./models/Trek');
const Booking = require('./models/Booking');
const Waitlist = require('./models/Waitlist');
const { reserveSeats, releaseSeats, promoteWaitlist } = require('./services/seats');

const future = () => new Date(Date.now() + 30 * 864e5);
const newTrek = (cap, left) => Trek.create({ name: 'T', region: 'R', difficulty: 1, days: 1, maxAltitude: 1, pricePerPerson: 100,
  batches: [{ startDate: future(), capacity: cap, seatsLeft: left }] });
const oid = () => new mongoose.Types.ObjectId();

before(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/trailmate_test');
  await Promise.all([Trek.deleteMany(), Booking.deleteMany(), Waitlist.deleteMany()]);
  await Booking.syncIndexes(); await Waitlist.syncIndexes();
});
after(() => mongoose.disconnect());

test('a user cannot hold two active bookings for the same batch', async () => {
  const doc = { user: oid(), trek: oid(), batchId: oid(), startDate: future(), seats: 1, totalPrice: 10 };
  await Booking.create(doc);
  await assert.rejects(Booking.create(doc), (e) => e.code === 11000);
});

test('atomic reservation never overbooks under concurrent requests', async () => {
  const t = await newTrek(2, 2);
  const b = t.batches[0]._id;
  const results = await Promise.all([1, 2, 3].map(() => reserveSeats(t._id, b, 2)));
  assert.strictEqual(results.filter(Boolean).length, 1);
});

test('freed seats go to the oldest waitlist entry as a held booking', async () => {
  const t = await newTrek(1, 0);
  const b = t.batches[0]._id;
  const first = oid(), second = oid();
  await Waitlist.create({ user: first, trek: t._id, batchId: b, seats: 1, createdAt: new Date(Date.now() - 5000) });
  await Waitlist.create({ user: second, trek: t._id, batchId: b, seats: 1 });
  await releaseSeats(t._id, b, 1);
  await promoteWaitlist(t._id, b);
  const booking = await Booking.findOne({ trek: t._id, batchId: b });
  assert.strictEqual(String(booking.user), String(first));
  assert.strictEqual(booking.status, 'held');
  assert.strictEqual(booking.fromWaitlist, true);
  assert.strictEqual((await Waitlist.findOne({ user: second })).status, 'waiting');
  assert.strictEqual((await Trek.findById(t._id)).batches[0].seatsLeft, 0);
});