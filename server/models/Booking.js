const mongoose = require('mongoose');
const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  trek: { type: mongoose.Schema.Types.ObjectId, ref: 'Trek', required: true },
  batchId: { type: mongoose.Schema.Types.ObjectId, required: true },
  startDate: { type: Date, required: true },
  seats: { type: Number, min: 1, max: 6, required: true },
  totalPrice: { type: Number, required: true },
  gearChecked: { type: [String], default: [] },
  status: { type: String, enum: ['held', 'confirmed', 'cancelled', 'expired'], default: 'held' },
  active: { type: Boolean, default: true },   // true while held or confirmed
  holdExpiresAt: Date,
  paidAt: Date,
  paymentRef: String,
  fromWaitlist: { type: Boolean, default: false },
}, { timestamps: true });
// One active (held or confirmed) booking per user per batch
bookingSchema.index({ user: 1, batchId: 1, active: 1 }, { unique: true, partialFilterExpression: { active: true } });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });
module.exports = mongoose.model('Booking', bookingSchema);