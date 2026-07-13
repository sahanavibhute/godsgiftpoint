import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String },
  password: { 
    type: String, 
    required: function() { return this.role === 'Admin'; } 
  },
  role: { type: String, enum: ['Admin', 'Trainee', 'Member'], required: true },
  
  // Member fields
  memberId: { type: String, unique: true, sparse: true },
  age: { type: Number },
  gender: { type: String },
  birthDate: { type: String },
  joinDate: { type: String },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Active', 'Expired', 'Pending'], default: 'Active' },
  isPhoneVerified: { type: Boolean, default: false },
  medicalIssues: { type: String },
  reasonForJoining: { type: String },
  weight: { type: Number },
  height: { type: Number },
  weightHistory: [
    {
      date: { type: String, required: true },
      weight: { type: Number, required: true }
    }
  ],
  heightHistory: [
    {
      date: { type: String, required: true },
      height: { type: Number, required: true }
    }
  ],


  // Trainee fields
  traineeId: { type: String, unique: true, sparse: true },
  specialization: { type: String },
  shift: { type: String, enum: ['Morning', 'Evening'] },
  isActive: { type: Boolean, default: true },

  // Member progress tracking reports
  progressReports: [
    {
      date: { type: String, required: true },
      notes: { type: String, required: true },
      performanceRating: { type: Number },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  ]
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', function() {
  if (this.password && this.isModified('password')) {
    const salt = bcrypt.genSaltSync(10);
    this.password = bcrypt.hashSync(this.password, salt);
  }
});


// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema);
