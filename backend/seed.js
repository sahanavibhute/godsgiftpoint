import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from './db.js';
import User from './models/user.js';
import Plan from './models/plan.js';
import Payment from './models/payment.js';
import DietPlan from './models/dietPlan.js';
import Slot from './models/slot.js';
import Otp from './models/otp.js';

dotenv.config();

const seed = async () => {
  try {
    // Connect to database
    await connectDB();

    console.log('Clearing database...');
    await User.deleteMany({});
    await Plan.deleteMany({});
    await Payment.deleteMany({});
    await DietPlan.deleteMany({});
    await Slot.deleteMany({});
    await Otp.deleteMany({});

    console.log('Seeding Membership Plans...');
    // Create plans
    const gymPlans = await Plan.create([
      // Gym Membership
      { name: 'Gym Membership - 1 Month', price: 1000, durationMonths: 1 },
      { name: 'Gym Membership - 3 Months', price: 2500, durationMonths: 3 },
      { name: 'Gym Membership - 6 Months', price: 4500, durationMonths: 6 },
      { name: 'Gym Membership - 12 Months', price: 7500, durationMonths: 12 },
      
      // Personal Training
      { name: 'Personal Training - 1 Month', price: 5000, durationMonths: 1 },
      { name: 'Personal Training - 3 Months', price: 12000, durationMonths: 3 },

      // Gym + Cardio + Abs + Circuit
      { name: 'Gym + Cardio + Abs + Circuit - 1 Month', price: 1500, durationMonths: 1 },
      { name: 'Gym + Cardio + Abs + Circuit - 3 Months', price: 3500, durationMonths: 3 },
      { name: 'Gym + Cardio + Abs + Circuit - 6 Months', price: 6000, durationMonths: 6 },
      { name: 'Gym + Cardio + Abs + Circuit - 12 Months', price: 9000, durationMonths: 12 }
    ]);

    console.log('Seeding Default Admin...');
    const admin = await User.create({
      name: "God's Gift Gym Admin",
      phone: '7887358585',
      password: 'Aditya@9',
      role: 'Admin'
    });

    console.log('Seeding Trainees...');
    const trainer1 = await User.create({
      name: 'Sophia Martinez',
      phone: '9988776655',
      email: 'sophia@godsgiftfitness.com',
      role: 'Trainee',
      traineeId: 'T-1001',
      specialization: 'HIIT, Cardio Circuits',
      shift: 'Morning',
      isActive: true
    });

    const trainer2 = await User.create({
      name: 'Marcus Chen',
      phone: '9988776644',
      email: 'marcus@godsgiftfitness.com',
      role: 'Trainee',
      traineeId: 'T-1002',
      specialization: 'Bodybuilding, Strength',
      shift: 'Evening',
      isActive: true
    });

    console.log('Seeding Members...');
    const plan1 = gymPlans.find(p => p.name === 'Gym Membership - 3 Months');
    const plan2 = gymPlans.find(p => p.name === 'Gym + Cardio + Abs + Circuit - 1 Month');
    const plan3 = gymPlans.find(p => p.name === 'Gym Membership - 1 Month');

    const member1 = await User.create({
      name: 'John Doe',
      phone: '9876543210',
      email: 'john.doe@gmail.com',
      role: 'Member',
      memberId: 'M-1001',
      age: 28,
      gender: 'Male',
      birthDate: '1998-05-15',
      joinDate: '2026-05-15',
      planId: plan1._id,
      trainerId: trainer1._id,
      status: 'Active',
      medicalIssues: 'None',
      reasonForJoining: 'Muscle Building',
      weight: 78,
      height: 180,
      weightHistory: [
        { date: '2026-05-15', weight: 75.0 },
        { date: '2026-05-30', weight: 76.2 },
        { date: '2026-06-15', weight: 77.1 },
        { date: '2026-06-26', weight: 78.0 }
      ],
      heightHistory: [
        { date: '2026-05-15', height: 180 }
      ]
    });

    const member2 = await User.create({
      name: 'Emma Watson',
      phone: '9876543211',
      email: 'emma.w@gmail.com',
      role: 'Member',
      memberId: 'M-1002',
      age: 24,
      gender: 'Female',
      birthDate: '2002-09-20',
      joinDate: '2026-06-01',
      planId: plan2._id,
      trainerId: trainer2._id,
      status: 'Active',
      medicalIssues: 'Mild Asthma',
      reasonForJoining: 'Weight Loss',
      weight: 56,
      height: 165,
      weightHistory: [
        { date: '2026-06-01', weight: 58.5 },
        { date: '2026-06-10', weight: 57.2 },
        { date: '2026-06-20', weight: 56.5 },
        { date: '2026-06-26', weight: 56.0 }
      ],
      heightHistory: [
        { date: '2026-06-01', height: 165 }
      ]
    });

    const member3 = await User.create({
      name: 'Sarah Jenkins',
      phone: '9876543212',
      email: 'sarah.j@outlook.com',
      role: 'Member',
      memberId: 'M-1003',
      age: 31,
      gender: 'Female',
      birthDate: '1995-02-10',
      joinDate: '2026-05-10',
      planId: plan3._id,
      status: 'Expired',
      medicalIssues: 'Hypertension',
      reasonForJoining: 'General Health',
      weight: 72,
      height: 168
    });

    const member4 = await User.create({
      _id: '6a588fbb15e36423f156d7d1',
      name: 'Sahana Vibhute',
      phone: '8668864498',
      role: 'Member',
      memberId: 'M-1004',
      age: 23,
      gender: 'Female',
      birthDate: '2003-01-10',
      joinDate: '2026-06-10',
      planId: plan1._id,
      trainerId: trainer1._id,
      status: 'Active',
      medicalIssues: 'None',
      reasonForJoining: 'Fitness',
      weight: 60,
      height: 162,
      weightHistory: [
        { date: '2026-06-10', weight: 60 }
      ],
      heightHistory: [
        { date: '2026-06-10', height: 162 }
      ]
    });

    console.log('Seeding Payments...');
    await Payment.create([
      {
        memberId: member1._id,
        planId: plan1._id,
        amount: plan1.price,
        dueAmount: 0,
        paymentDate: '2026-05-15',
        dueDate: '2026-08-15',
        status: 'Paid',
        invoiceNumber: 'INV-2026-001'
      },
      {
        memberId: member2._id,
        planId: plan2._id,
        amount: plan2.price,
        dueAmount: 0,
        paymentDate: '2026-06-01',
        dueDate: '2026-07-01',
        status: 'Paid',
        invoiceNumber: 'INV-2026-002'
      },
      {
        memberId: member3._id,
        planId: plan3._id,
        amount: plan3.price,
        dueAmount: 0,
        paymentDate: '2026-05-10',
        dueDate: '2026-06-10',
        status: 'Overdue',
        invoiceNumber: 'INV-2026-003'
      },
      {
        memberId: member4._id,
        planId: plan1._id,
        amount: plan1.price,
        dueAmount: 0,
        paymentDate: '2026-06-10',
        dueDate: '2026-09-10',
        status: 'Paid',
        invoiceNumber: 'INV-2026-004'
      }
    ]);



    console.log('Seeding Slots...');
    await Slot.create([
      {
        name: 'Morning General Batch',
        timeRange: '06:00 AM - 07:30 AM',
        trainerId: trainer1._id,
        maxCapacity: 25,
        enrolledMembers: [member1._id]
      },
      {
        name: 'Evening Muscle Building Batch',
        timeRange: '06:30 PM - 08:00 PM',
        trainerId: trainer2._id,
        maxCapacity: 20,
        enrolledMembers: [member2._id]
      }
    ]);

    console.log('Seeding Diet Plans...');
    await DietPlan.create([
      {
        memberId: member1._id,
        workoutRoutine: [
          { day: 'Monday (Push)', exercises: 'Bench Press (4x8), Overhead Press (3x10), Tricep Dips (3x12)' },
          { day: 'Wednesday (Pull)', exercises: 'Lat Pulldowns (4x10), Rows (3x12), Bicep Curls (3x15)' },
          { day: 'Friday (Legs)', exercises: 'Leg Press (4x10), Romanian Deadlifts (3x12), Leg Extensions (3x15)' }
        ],
        dietRoutine: [
          { meal: 'Breakfast', items: '4 Egg whites + 2 whole eggs, 1 cup of oats' },
          { meal: 'Lunch', items: '200g Grilled chicken breast, 150g rice, steamed broccoli' },
          { meal: 'Dinner', items: '150g Grilled Salmon, mixed green salad' }
        ],
        updatedBy: trainer1._id
      },
      {
        memberId: member2._id,
        workoutRoutine: [
          { day: 'Mon/Wed/Fri (HIIT & Cardio)', exercises: 'Kettlebell Swings (4x45s), Dumbbell Thrusters (4x12), Rowing (15 mins)' }
        ],
        dietRoutine: [
          { meal: 'Breakfast', items: 'Greek Yogurt with chia seeds, handful of almonds' },
          { meal: 'Lunch', items: 'Tuna salad with mixed greens, cherry tomatoes' },
          { meal: 'Dinner', items: 'Baked cod file, roasted sweet potato, asparagus' }
        ],
        updatedBy: trainer2._id
      },
      {
        memberId: member4._id,
        workoutRoutine: [
          { day: 'Mon/Tue/Thu/Fri (Lean Muscle)', exercises: 'Squats (4x10), Bench Press (4x8), Pull-ups (3xMax), Planks (3x1 min)' }
        ],
        dietRoutine: [
          { meal: 'Breakfast', items: '3 Egg whites, avocado toast, green tea' },
          { meal: 'Lunch', items: 'Grilled chicken breast with quinoa and salad' },
          { meal: 'Dinner', items: 'Salmon fillet with steamed veggies' }
        ],
        updatedBy: trainer1._id
      }
    ]);

    console.log('Seeding completed successfully!');
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seed();
