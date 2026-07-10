import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  phone: { type: String },
  email: { type: String },
  code: { type: String, required: true },
  expiresAt: { type: Date, required: true }
}, {
  timestamps: true
});

// Expire the OTP document when expiresAt is reached
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Otp', OtpSchema);
