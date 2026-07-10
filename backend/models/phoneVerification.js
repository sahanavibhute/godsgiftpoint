import mongoose from 'mongoose';

const PhoneVerificationSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  isVerified: { type: Boolean, default: false },
  code: { type: String }, // Stored for terminal fallback verification
  expiresAt: { type: Date, required: true }
}, {
  timestamps: true
});

export default mongoose.model('PhoneVerification', PhoneVerificationSchema);
