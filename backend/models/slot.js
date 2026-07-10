import mongoose from 'mongoose';

const SlotSchema = new mongoose.Schema({
  name: { type: String, required: true },
  timeRange: { type: String, required: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  maxCapacity: { type: Number, default: 20 },
  enrolledMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, {
  timestamps: true
});

export default mongoose.model('Slot', SlotSchema);
