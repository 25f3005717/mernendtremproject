require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { releaseExpired } = require('./services/seats');

if (!process.env.JWT_SECRET || !process.env.MONGO_URI) { console.error('Missing JWT_SECRET or MONGO_URI in .env'); process.exit(1); }
const app = express();
app.set('trust proxy', 1); // needed behind a host's proxy so rate limiting works per user
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '50kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true }));
app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/treks', require('./routes/treks'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (_, res) => res.status(404).json({ error: 'Not found.' }));

// Serve the built React app (client/dist) from the same server in production
const dist = path.join(__dirname, '../client/dist');
app.use(express.static(dist));
app.get('*', (req, res, next) => res.sendFile(path.join(dist, 'index.html'), (err) => err && next()));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong on our side. Please try again.' }); });

mongoose.connect(process.env.MONGO_URI).then(() => {
  app.listen(process.env.PORT || 5000, () => console.log('API on :' + (process.env.PORT || 5000)));
  // Background job: release unpaid holds and offer the seats to the waitlist
  setInterval(() => releaseExpired().catch(e => console.error('Hold sweep failed:', e.message)), 30 * 1000);
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });