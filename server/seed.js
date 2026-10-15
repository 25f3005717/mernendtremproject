require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Trek = require('./models/Trek');
const User = require('./models/User');
const Booking = require('./models/Booking');
const Waitlist = require('./models/Waitlist');

const d = (n) => new Date(Date.now() + n * 864e5);
const mk = (name, region, difficulty, days, maxAltitude, price, season, description, cap = 12) => ({
  name, region, difficulty, days, maxAltitude, pricePerPerson: price, season, description,
  itinerary: Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    title: i === days - 1 ? 'Descent and departure' : i === days - 2 ? 'Summit day' : 'Trek day ' + (i + 1),
    altitude: Math.round(maxAltitude * (i === days - 1 ? 0.45 : 0.45 + 0.55 * Math.min(1, i / Math.max(1, days - 2))) / 50) * 50,
  })),
  batches: [30, 60, 95].map(n => ({ startDate: d(n), capacity: cap, seatsLeft: cap })),
});

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Trek.deleteMany(), User.deleteMany(), Booking.deleteMany(), Waitlist.deleteMany()]);
  await Promise.all([Trek.syncIndexes(), User.syncIndexes(), Booking.syncIndexes(), Waitlist.syncIndexes()]);
  await Trek.insertMany([
    mk('Kuari Pass', 'Uttarakhand', 1, 5, 3800, 8500, ['winter', 'spring'], 'Gentle snow trek with Nanda Devi views.'),
    mk('Triund', 'Himachal Pradesh', 1, 2, 2850, 3200, ['spring', 'autumn', 'winter'], 'Short ridge walk above McLeod Ganj.'),
    mk('Kedarkantha', 'Uttarakhand', 2, 6, 3800, 9800, ['winter'], 'Classic winter summit through pine forests.'),
    mk('Hampta Pass', 'Himachal Pradesh', 2, 5, 4270, 11500, ['summer', 'monsoon'], 'Crosses from green Kullu into barren Lahaul.'),
    mk('Sandakphu', 'West Bengal', 2, 6, 3636, 10500, ['spring', 'autumn'], 'Walk along the Singalila ridge facing Kanchenjunga.'),
    mk('Roopkund', 'Uttarakhand', 3, 8, 4800, 15500, ['summer', 'autumn'], 'High-altitude trek to the skeleton lake.', 10),
    mk('Stok Kangri', 'Ladakh', 3, 9, 6153, 24000, ['summer'], 'Non-technical 6000m peak. Acclimatisation required.', 8),
    mk('Chadar', 'Ladakh', 3, 9, 3400, 26000, ['winter'], 'Walk on the frozen Zanskar river.', 8),
  ]);
  // Local default is password123. For a deployed database run with SEED_PASSWORD set.
  const password = process.env.SEED_PASSWORD || 'password123';
  const hash = await bcrypt.hash(password, 10);
  await User.create([
    { name: 'Admin', email: 'admin@trailmate.dev', passwordHash: hash, role: 'admin', experience: 3 },
    { name: 'Asha', email: 'asha@trailmate.dev', passwordHash: hash, experience: 1 },
  ]);
  console.log('Seeded. Logins: admin@trailmate.dev and asha@trailmate.dev' +
    (process.env.SEED_PASSWORD ? ' (password from SEED_PASSWORD)' : ', password: password123'));
  process.exit(0);
})();