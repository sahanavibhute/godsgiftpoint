import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  amount: { type: Number, required: true },
  dueAmount: { type: Number, default: 0 },
  paymentDate: { type: String, required: true },
  dueDate: { type: String, required: true },
  status: { type: String, enum: ['Paid', 'Pending', 'Overdue', 'Partially Paid'], default: 'Pending' },
  invoiceNumber: { type: String, required: true, unique: true }
}, {
  timestamps: true
});

PaymentSchema.index({ memberId: 1 });
PaymentSchema.index({ dueDate: -1 });

export default mongoose.model('Payment', PaymentSchema);
