const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['trekker', 'admin'], default: 'trekker' },
  // used by the recommendation logic: 1 = beginner ... 3 = experienced
  experience: { type: Number, min: 1, max: 3, default: 1 },
}, { timestamps: true });
module.exports = mongoose.model('User', userSchema);
