const mongoose = require('mongoose');
const batchSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1 },
  seatsLeft: { type: Number, required: true, min: 0 },
});
const trekSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  region: { type: String, required: true },
  difficulty: { type: Number, min: 1, max: 3, required: true }, // 1 easy, 2 moderate, 3 hard
  days: { type: Number, min: 1, required: true },
  maxAltitude: { type: Number, required: true }, // metres
  pricePerPerson: { type: Number, required: true },
  season: [{ type: String, enum: ['winter', 'spring', 'summer', 'monsoon', 'autumn'] }],
  description: String,
  itinerary: [{ day: Number, title: String, altitude: Number }],
  batches: [batchSchema],
}, { timestamps: true });
trekSchema.index({ name: 'text', region: 'text', description: 'text' });
module.exports = mongoose.model('Trek', trekSchema);
