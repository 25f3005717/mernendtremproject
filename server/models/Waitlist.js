const mongoose = require('mongoose');
const waitlistSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trek: { type: mongoose.Schema.Types.ObjectId, ref: 'Trek', required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, required: true },
  seats: { type: Number, min: 1, max: 6, required: true },
  status: { type: String, enum: ['waiting', 'promoted', 'left'], default: 'waiting' },
}, { timestamps: true });
waitlistSchema.index({ user: 1, batchId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'waiting' } });
module.exports = mongoose.model('Waitlist', waitlistSchema);