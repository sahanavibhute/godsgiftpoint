import mongoose from 'mongoose';

const DietPlanSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  workoutRoutine: [
    {
      day: { type: String, required: true },
      exercises: { type: String, required: true }
    }
  ],
  dietRoutine: [
    {
      meal: { type: String, required: true },
      items: { type: String, required: true }
    }
  ],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

export default mongoose.model('DietPlan', DietPlanSchema);
