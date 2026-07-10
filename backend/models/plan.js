import mongoose from 'mongoose';

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  durationMonths: { type: Number, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

export default mongoose.model('Plan', PlanSchema);
