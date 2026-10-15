const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, experience: u.experience });

const registerSchema = z.object({
  name: z.string().min(2), email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  experience: z.number().int().min(1).max(3).optional(),
});

router.post('/register', async (req, res, next) => {
  try {
    const p = registerSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0].message });
    if (await User.findOne({ email: p.data.email.toLowerCase() }))
      return res.status(409).json({ error: 'An account with this email already exists.' });
    const { password, ...rest } = p.data;
    const user = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(user), user: pub(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.passwordHash)))
      return res.status(401).json({ error: 'Incorrect email or password.' });
    res.json({ token: sign(user), user: pub(user) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: pub(user) });
});
module.exports = router;
