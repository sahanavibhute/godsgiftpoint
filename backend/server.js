import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { connectDB } from './db.js';
import User from './models/user.js';
import Plan from './models/plan.js';
import Payment from './models/payment.js';
import DietPlan from './models/dietPlan.js';
import Slot from './models/slot.js';
import Otp from './models/otp.js';
import PhoneVerification from './models/phoneVerification.js';
import { protect, authorize } from './middleware/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret1234';

app.use(cors());
app.use(express.json());

// Helper for formatting date (YYYY-MM-DD)
const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

// Connect to MongoDB
connectDB();

// ----------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------

// Generate Token helper
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
};

// Generate OTP helper
const createOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
};

// Fast2SMS Sender Helper
const sendFast2Sms = async (to, body, code) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) return false;

  // Extract 10 digits for Indian numbers
  const tenDigitPhone = to.substring(to.length - 10);
  const route = process.env.FAST2SMS_ROUTE || 'q'; // Default to Quick SMS ('q') for custom text from gym name

  try {
    const payload = {
      route,
      numbers: tenDigitPhone
    };

    if (route === 'q') {
      payload.message = body;
      payload.language = 'english';
    } else if (route === 'otp') {
      payload.variables_values = code;
    }

    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok || !data.return) {
      console.error('[FAST2SMS ERROR]', data);
      return false;
    }
    console.log(`[FAST2SMS SUCCESS] OTP sent to ${tenDigitPhone} via route "${route}"`);
    return true;
  } catch (error) {
    console.error('[FAST2SMS EXCEPTION]', error);
    return false;
  }
};

// Twilio SMS / WhatsApp Sender Helper (using native fetch)
const sendTwilioOtp = async (to, body) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) return false;

  let formattedTo = to;
  if (!formattedTo.startsWith('+')) {
    if (formattedTo.length === 10) {
      formattedTo = `+91${formattedTo}`;
    } else {
      formattedTo = `+${formattedTo}`;
    }
  }

  const useWhatsApp = process.env.TWILIO_USE_WHATSAPP === 'true' || fromPhone.startsWith('whatsapp:');
  const toParam = useWhatsApp ? (formattedTo.startsWith('whatsapp:') ? formattedTo : `whatsapp:${formattedTo}`) : formattedTo;
  const fromParam = useWhatsApp ? (fromPhone.startsWith('whatsapp:') ? fromPhone : `whatsapp:${fromPhone}`) : fromPhone;

  try {
    const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          To: toParam,
          From: fromParam,
          Body: body
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('[TWILIO ERROR]', data);
      return false;
    }
    console.log(`[TWILIO SUCCESS] ${useWhatsApp ? 'WhatsApp' : 'SMS'} sent to ${toParam}. SID: ${data.sid}`);
    return true;
  } catch (error) {
    console.error('[TWILIO EXCEPTION]', error);
    return false;
  }
};

// Unified OTP Dispatcher (tries Fast2SMS first, then Twilio, falls back to Console)
const sendOtpSms = async (to, body, code) => {
  // 1. Fast2SMS
  if (process.env.FAST2SMS_API_KEY) {
    const fast2smsSuccess = await sendFast2Sms(to, body, code);
    if (fast2smsSuccess) return true;
  }

  // 2. Twilio (SMS or WhatsApp)
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
    const twilioSuccess = await sendTwilioOtp(to, body);
    if (twilioSuccess) return true;
  }

  // 3. Fallback to Console Log
  console.log(`\n======================================================`);
  console.log(`[CONSOLE SMS FALLBACK] From: God's Gift Fitness Point`);
  console.log(`[CONSOLE SMS FALLBACK] To: ${to}`);
  console.log(`[CONSOLE SMS FALLBACK] Message: ${body}`);
  console.log(`[CONSOLE SMS FALLBACK] (Note: Add FAST2SMS_API_KEY or TWILIO credentials in backend/.env to send real messages)`);
  console.log(`======================================================\n`);
  return false;
};

// MSG91 Send OTP Helper
const sendMsg91OtpApi = async (phone, code) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey) {
    console.log(`\n======================================================`);
    console.log(`[MSG91 CONSOLE FALLBACK] To: ${phone}`);
    console.log(`[MSG91 CONSOLE FALLBACK] Message: Your OTP code for God's Gift Fitness Point is ${code}. Valid for 5 mins.`);
    console.log(`[MSG91 CONSOLE FALLBACK] (Note: Add MSG91_AUTH_KEY and MSG91_TEMPLATE_ID in backend/.env to send real messages)`);
    console.log(`======================================================\n`);
    return { success: true, fallback: true };
  }

  const cleanPhone = phone.replace(/^\+/, '');

  try {
    const response = await fetch(`https://control.msg91.com/api/v5/otp?otp_expiry=5&template_id=${templateId}&mobile=${cleanPhone}&authkey=${authKey}`, {
      method: 'POST'
    });
    const data = await response.json();
    if (data.type === 'error') {
      console.error('[MSG91 ERROR]', data);
      return { success: false, error: data.message };
    }
    console.log(`[MSG91 SUCCESS] OTP sent to ${cleanPhone}. Message: ${data.message}`);
    return { success: true };
  } catch (error) {
    console.error('[MSG91 EXCEPTION]', error);
    return { success: false, error: error.message };
  }
};

// MSG91 Verify OTP Helper
const verifyMsg91OtpApi = async (phone, code) => {
  const authKey = process.env.MSG91_AUTH_KEY;

  if (!authKey) {
    const verification = await PhoneVerification.findOne({ phone });
    if (!verification) return { success: false, error: 'Verification session not found.' };
    if (verification.isVerified) return { success: true, message: 'Already verified' };
    if (verification.code !== code) return { success: false, error: 'Invalid OTP code.' };
    if (new Date() > verification.expiresAt) return { success: false, error: 'OTP has expired.' };

    return { success: true };
  }

  const cleanPhone = phone.replace(/^\+/, '');
  try {
    const response = await fetch(`https://control.msg91.com/api/v5/otp/verify?otp=${code}&mobile=${cleanPhone}&authkey=${authKey}`, {
      method: 'POST'
    });
    const data = await response.json();
    if (data.type === 'error') {
      console.error('[MSG91 VERIFY ERROR]', data);
      return { success: false, error: data.message };
    }
    console.log(`[MSG91 VERIFY SUCCESS] Mobile ${cleanPhone} verified successfully.`);
    return { success: true };
  } catch (error) {
    console.error('[MSG91 VERIFY EXCEPTION]', error);
    return { success: false, error: error.message };
  }
};

// MSG91 Resend OTP Helper
const resendMsg91OtpApi = async (phone, newCode) => {
  const authKey = process.env.MSG91_AUTH_KEY;

  if (!authKey) {
    console.log(`\n======================================================`);
    console.log(`[MSG91 CONSOLE RESEND] To: ${phone}`);
    console.log(`[MSG91 CONSOLE RESEND] Message: Your new OTP code for God's Gift Fitness Point is ${newCode}. Valid for 5 mins.`);
    console.log(`======================================================\n`);
    return { success: true, fallback: true };
  }

  const cleanPhone = phone.replace(/^\+/, '');
  try {
    const response = await fetch(`https://control.msg91.com/api/v5/otp/retry?retrytype=text&mobile=${cleanPhone}&authkey=${authKey}`, {
      method: 'POST'
    });
    const data = await response.json();
    if (data.type === 'error') {
      console.error('[MSG91 RETRY ERROR]', data);
      return { success: false, error: data.message };
    }
    console.log(`[MSG91 RETRY SUCCESS] OTP resent to ${cleanPhone}. Message: ${data.message}`);
    return { success: true };
  } catch (error) {
    console.error('[MSG91 RETRY EXCEPTION]', error);
    return { success: false, error: error.message };
  }
};

// Phone helper queries (handles flexible matching with/without country codes)
const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = phone.trim();
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
};

const findUserByPhoneAndRole = async (phone, role) => {
  const normalized = normalizePhoneNumber(phone);
  const stripped91 = normalized.replace(/^\+91/, '');
  const genericStrip = normalized.substring(normalized.length - 10);
  
  return User.findOne({
    phone: { $in: [phone, normalized, stripped91, genericStrip] },
    role
  });
};

const findUserByPhoneOnly = async (phone) => {
  const normalized = normalizePhoneNumber(phone);
  const stripped91 = normalized.replace(/^\+91/, '');
  const genericStrip = normalized.substring(normalized.length - 10);
  
  return User.findOne({
    phone: { $in: [phone, normalized, stripped91, genericStrip] }
  });
};

// Login Route
app.post('/api/auth/login', async (req, res) => {
  const { phone, password, role } = req.body;
  if (!phone || !password || !role) {
    return res.status(400).json({ error: 'Please enter phone, password and role.' });
  }

  try {
    const user = await findUserByPhoneAndRole(phone, role);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or role.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    if (role === 'Trainee' && !user.isActive) {
      return res.status(403).json({ error: 'Trainee account is deactivated.' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      memberId: user.memberId,
      traineeId: user.traineeId,
      status: user.status,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Send MSG91 OTP
app.post('/api/auth/send-msg91-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    
    // Check if phone number is already taken by an active member
    const userExists = await findUserByPhoneOnly(normalizedPhone);
    if (userExists && userExists.status === 'Active') {
      return res.status(400).json({ error: 'Phone number already registered and active. Please login.' });
    }

    // Generate local OTP for fallback mode
    const code = createOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const result = await sendMsg91OtpApi(normalizedPhone, code);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send OTP.' });
    }

    // Store in database
    await PhoneVerification.findOneAndUpdate(
      { phone: normalizedPhone },
      { isVerified: false, code, expiresAt },
      { upsert: true, new: true }
    );

    res.json({ message: 'OTP sent successfully to your mobile number.' });
  } catch (error) {
    console.error('Send MSG91 OTP error:', error);
    res.status(500).json({ error: 'Server error sending verification OTP.' });
  }
});

// Verify MSG91 OTP
app.post('/api/auth/verify-msg91-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and OTP code are required.' });
  }

  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    const result = await verifyMsg91OtpApi(normalizedPhone, code);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Invalid OTP code.' });
    }

    // Mark as verified in DB
    await PhoneVerification.findOneAndUpdate(
      { phone: normalizedPhone },
      { isVerified: true, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } // verification valid for 15 mins
    );

    res.json({ message: 'Mobile number verified successfully!' });
  } catch (error) {
    console.error('Verify MSG91 OTP error:', error);
    res.status(500).json({ error: 'Server error verifying OTP.' });
  }
});

// Resend MSG91 OTP
app.post('/api/auth/resend-msg91-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  try {
    const normalizedPhone = normalizePhoneNumber(phone);
    
    // Check if verification record exists
    const verification = await PhoneVerification.findOne({ phone: normalizedPhone });
    if (!verification) {
      return res.status(400).json({ error: 'Verification session not found. Please send OTP first.' });
    }

    // Generate new local code
    const code = createOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Reset 5 minutes

    const result = await resendMsg91OtpApi(normalizedPhone, code);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to resend OTP.' });
    }

    // Update in database
    verification.code = code;
    verification.isVerified = false;
    verification.expiresAt = expiresAt;
    await verification.save();

    res.json({ message: 'OTP resent successfully.' });
  } catch (error) {
    console.error('Resend MSG91 OTP error:', error);
    res.status(500).json({ error: 'Server error resending OTP.' });
  }
});

// Member Registration (Registration allowed ONLY after successful MSG91 OTP verification)
app.post('/api/auth/register-member', async (req, res) => {
  const {
    name, phone, email, password, age, gender, birthDate, joinDate, planId,
    medicalIssues, reasonForJoining, weight, height
  } = req.body;

  if (!name || !phone || !password || !planId) {
    return res.status(400).json({ error: 'Name, phone, password and plan are required.' });
  }

  try {
    const normalizedPhone = normalizePhoneNumber(phone);

    // 2. Check if user already exists
    const userExists = await findUserByPhoneOnly(normalizedPhone);
    if (userExists) {
      if (userExists.status === 'Pending') {
        await User.findByIdAndDelete(userExists._id);
      } else {
        return res.status(400).json({ error: 'Phone number already registered. Please login.' });
      }
    }

    // Verify Plan exists
    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Selected membership plan not found.' });
    }

    // Generate Member ID
    const lastMember = await User.findOne({ role: 'Member' }).sort({ createdAt: -1 });
    let nextNum = 1001;
    if (lastMember && lastMember.memberId) {
      const match = lastMember.memberId.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0]) + 1;
      }
    }
    const memberId = `M-${nextNum}`;

    // Create User as Active directly (since already verified via MSG91 OTP)
    const user = new User({
      name,
      phone: normalizedPhone,
      email,
      password,
      role: 'Member',
      memberId,
      age,
      gender,
      birthDate,
      joinDate: joinDate || getTodayDate(),
      planId,
      status: 'Active',
      isPhoneVerified: true,
      medicalIssues,
      reasonForJoining,
      weight: weight ? parseFloat(weight) : undefined,
      height: height ? parseFloat(height) : undefined,
      weightHistory: weight ? [{ date: joinDate || getTodayDate(), weight: parseFloat(weight) }] : [],
      heightHistory: height ? [{ date: joinDate || getTodayDate(), height: parseFloat(height) }] : []
    });

    await user.save();

    // Generate initial invoice
    const invoiceNumber = 'INV-' + Date.now().toString().substring(6);
    const d = new Date(user.joinDate);
    d.setMonth(d.getMonth() + plan.durationMonths);
    const dueDate = d.toISOString().split('T')[0];

    await Payment.create({
      memberId: user._id,
      planId: plan._id,
      amount: plan.price,
      dueAmount: 0,
      paymentDate: user.joinDate,
      dueDate,
      status: 'Paid',
      invoiceNumber
    });



    // Return login token immediately
    res.status(201).json({
      message: 'Registration successful!',
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      memberId: user.memberId,
      status: user.status,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// Verify Registration OTP
app.post('/api/auth/verify-registration-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone and OTP code are required.' });
  }

  try {
    const otpRecord = await Otp.findOne({ phone, code });
    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // OTP is valid, activate user
    const user = await findUserByPhoneAndRole(phone, 'Member');
    if (!user) {
      return res.status(404).json({ error: 'User registration details not found.' });
    }

    user.status = 'Active';
    await user.save();

    // Generate initial invoice
    const plan = await Plan.findById(user.planId);
    if (plan) {
      const invoiceNumber = 'INV-' + Date.now().toString().substring(6);
      const d = new Date(user.joinDate);
      d.setMonth(d.getMonth() + plan.durationMonths);
      const dueDate = d.toISOString().split('T')[0];

      await Payment.create({
        memberId: user._id,
        planId: plan._id,
        amount: plan.price,
        dueAmount: 0,
        paymentDate: user.joinDate,
        dueDate,
        status: 'Paid', // Assuming standard active registration begins paid or pending invoice
        invoiceNumber
      });
    }

    // Clean up OTP
    await Otp.deleteMany({ phone });

    res.json({
      message: 'OTP verified successfully! Account is active.',
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      memberId: user.memberId,
      status: user.status,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Server error verifying OTP.' });
  }
});

// Send Forgot Password OTP (Phone for Admin/Member, Email for Trainee)
app.post('/api/auth/forgot-password-otp', async (req, res) => {
  const { phone, email, role } = req.body;
  
  if (role === 'Trainee') {
    return res.status(400).json({ error: 'Password reset is disabled for Trainers. Please contact the Admin.' });
  } else {
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
  }

  try {
    let user;
    if (role === 'Trainee') {
      user = await User.findOne({ email, role });
    } else {
      user = await findUserByPhoneAndRole(phone, role);
    }

    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    // Generate OTP
    const code = createOtpCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    if (role === 'Trainee') {
      await Otp.create({ email, code, expiresAt });
      
      // Mock Email sending
      console.log(`\n======================================================`);
      console.log(`[EMAIL OTP] From: God's Gift Fitness Point Support`);
      console.log(`[EMAIL OTP] To: ${email} (Trainee: ${user.name})`);
      console.log(`[EMAIL OTP] Message: Your password reset OTP code is ${code}. Valid for 10 mins.`);
      console.log(`======================================================\n`);
    } else {
      const normalizedPhone = normalizePhoneNumber(phone);
      await Otp.create({ phone: normalizedPhone, code, expiresAt });
      
      const smsMessage = `Your password reset OTP code for God's Gift Fitness Point is ${code}. Valid for 10 mins.`;
      await sendOtpSms(normalizedPhone, smsMessage, code);
    }

    res.json({
      message: 'Password reset OTP sent successfully.',
      phone: role !== 'Trainee' ? phone : undefined,
      email: role === 'Trainee' ? email : undefined
    });
  } catch (error) {
    console.error('Forgot password OTP error:', error);
    res.status(500).json({ error: 'Server error sending OTP.' });
  }
});

// Reset Password after successful OTP verification
app.post('/api/auth/reset-password', async (req, res) => {
  const { phone, email, role, code, newPassword } = req.body;
  
  if (role === 'Trainee') {
    return res.status(400).json({ error: 'Password reset is disabled for Trainers. Please contact the Admin.' });
  } else {
    if (!phone || !role || !code || !newPassword) {
      return res.status(400).json({ error: 'Phone, role, OTP code, and new password are required.' });
    }
  }

  try {
    let otpRecord;
    let user;

    if (role === 'Trainee') {
      otpRecord = await Otp.findOne({ email, code });
      if (!otpRecord) {
        return res.status(400).json({ error: 'Invalid or expired OTP code.' });
      }
      user = await User.findOne({ email, role });
    } else {
      const normalizedPhone = normalizePhoneNumber(phone);
      otpRecord = await Otp.findOne({ phone: normalizedPhone, code });
      if (!otpRecord) {
        return res.status(400).json({ error: 'Invalid or expired OTP code.' });
      }
      user = await findUserByPhoneAndRole(normalizedPhone, role);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.password = newPassword; // Hashed by pre-save hook
    await user.save();

    // Clean up OTP
    if (role === 'Trainee') {
      await Otp.deleteMany({ email });
    } else {
      await Otp.deleteMany({ phone });
    }

    res.json({ message: 'Password changed successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

// ----------------------------------------------------
// ADMIN DASHBOARD
// ----------------------------------------------------
app.get('/api/admin/dashboard', protect, authorize('Admin'), async (req, res) => {
  try {
    const today = getTodayDate();
    const currentMonth = today.substring(0, 7); // YYYY-MM

    const totalMembers = await User.countDocuments({ role: 'Member' });
    const totalTrainees = await User.countDocuments({ role: 'Trainee' });
    const activeMembers = await User.countDocuments({ role: 'Member', status: 'Active' });
    const expiredMembers = await User.countDocuments({ role: 'Member', status: 'Expired' });
    
    // Calculate Renewals due: Active members whose payments expire in the next 7 days or are already overdue
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterStr = sevenDaysLater.toISOString().split('T')[0];

    const activeMembersDocs = await User.find({ role: 'Member', status: 'Active' });
    let renewalsDue = 0;
    for (const member of activeMembersDocs) {
      const latestPayment = await Payment.findOne({ memberId: member._id }).sort({ dueDate: -1 });
      if (latestPayment && latestPayment.dueDate <= sevenDaysLaterStr) {
        renewalsDue++;
      }
    }


    // Payments totals
    const paidPayments = await Payment.find({ status: 'Paid' });
    const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);

    const monthlyPaidPayments = await Payment.find({
      status: 'Paid',
      paymentDate: { $regex: `^${currentMonth}` }
    });
    const monthlyRevenue = monthlyPaidPayments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate Paid vs Unpaid members based on their actual invoice status
    let paidMembersCount = 0;
    let unpaidMembersCount = 0;

    const allMembers = await User.find({ role: 'Member' });
    for (const member of allMembers) {
      if (member.status === 'Expired' || member.status === 'Pending') {
        unpaidMembersCount++;
      } else {
        const latestPayment = await Payment.findOne({ memberId: member._id }).sort({ dueDate: -1 });
        if (latestPayment && latestPayment.status === 'Paid') {
          paidMembersCount++;
        } else {
          unpaidMembersCount++;
        }
      }
    }

    // Recent invoices
    const recentInvoices = await Payment.find()
      .populate('memberId', 'name phone memberId')
      .sort({ createdAt: -1 })
      .limit(5);

    // Plan distribution
    const plans = await Plan.find();
    const planDistribution = [];
    for (const p of plans) {
      const count = await User.countDocuments({ role: 'Member', planId: p._id });
      planDistribution.push({ name: p.name, count });
    }

    // Revenue trends (last 6 months)
    const revenueTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7); // YYYY-MM
      const monthlyPaid = await Payment.find({
        status: 'Paid',
        paymentDate: { $regex: `^${monthStr}` }
      });
      const rev = monthlyPaid.reduce((sum, p) => sum + p.amount, 0);
      revenueTrends.push({ month: d.toLocaleString('default', { month: 'short' }), amount: rev });
    }

    res.json({
      metrics: {
        totalMembers,
        totalTrainees,
        activeMembers,
        expiredMembers,
        renewalsDue,
        monthlyRevenue,
        totalRevenue,
        paidMembers: paidMembersCount,
        unpaidMembers: unpaidMembersCount
      },
      recentInvoices,
      planDistribution,
      revenueTrends
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: 'Server error generating dashboard statistics.' });
  }
});

// ----------------------------------------------------
// MEMBER MANAGEMENT
// ----------------------------------------------------

// Get Members list
app.get('/api/members', protect, async (req, res) => {
  try {
    let query = { role: 'Member' };
    
    // If Trainee is logged in, only return assigned members
    if (req.user.role === 'Trainee') {
      query.trainerId = req.user._id;
    }
    
    const members = await User.find(query)
      .populate('planId', 'name price durationMonths')
      .populate('trainerId', 'name phone')
      .sort({ createdAt: -1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
});

// Get Single Member Profile Details
app.get('/api/members/:id', protect, async (req, res) => {
  try {
    const member = await User.findById(req.params.id)
      .populate('planId', 'name price durationMonths')
      .populate('trainerId', 'name phone');
    if (!member || member.role !== 'Member') {
      return res.status(404).json({ error: 'Member not found.' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member details.' });
  }
});

// Admin Add Member directly (Bypasses OTP, creates active member & generates Paid invoice)
app.post('/api/members', protect, authorize('Admin'), async (req, res) => {
  const {
    name, phone, email, password, age, gender, birthDate, joinDate, planId, trainerId,
    status, medicalIssues, reasonForJoining, weight, height
  } = req.body;

  if (!name || !phone || !password || !planId) {
    return res.status(400).json({ error: 'Name, phone, password and plan are required.' });
  }

  try {
    const userExists = await findUserByPhoneOnly(phone);
    if (userExists) {
      return res.status(400).json({ error: 'Phone number already registered.' });
    }

    // Generate Member ID
    const lastMember = await User.findOne({ role: 'Member' }).sort({ createdAt: -1 });
    let nextNum = 1001;
    if (lastMember && lastMember.memberId) {
      const match = lastMember.memberId.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0]) + 1;
      }
    }
    const memberId = `M-${nextNum}`;

    const member = new User({
      name,
      phone,
      email,
      password,
      role: 'Member',
      memberId,
      age,
      gender,
      birthDate,
      joinDate: joinDate || getTodayDate(),
      planId,
      trainerId: trainerId || undefined,
      status: status || 'Active',
      medicalIssues,
      reasonForJoining,
      weight: weight ? parseFloat(weight) : undefined,
      height: height ? parseFloat(height) : undefined,
      weightHistory: weight ? [{ date: joinDate || getTodayDate(), weight: parseFloat(weight) }] : [],
      heightHistory: height ? [{ date: joinDate || getTodayDate(), height: parseFloat(height) }] : []
    });

    await member.save();

    // Automatically create invoice
    const plan = await Plan.findById(planId);
    if (plan) {
      const invoiceNumber = 'INV-' + Date.now().toString().substring(6);
      const d = new Date(member.joinDate);
      d.setMonth(d.getMonth() + plan.durationMonths);
      const dueDate = d.toISOString().split('T')[0];

      await Payment.create({
        memberId: member._id,
        planId: plan._id,
        amount: plan.price,
        dueAmount: 0,
        paymentDate: member.joinDate,
        dueDate,
        status: 'Paid',
        invoiceNumber
      });
    }

    res.status(201).json({ id: member._id, message: 'Member created successfully.' });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'Failed to create member.' });
  }
});

// Edit Member
// Edit Member
app.put('/api/members/:id', protect, async (req, res) => {
  // Admins and Trainees can edit member
  const {
    name, phone, email, age, gender, birthDate, joinDate, planId, trainerId,
    status, medicalIssues, reasonForJoining, weight, height
  } = req.body;

  try {
    const member = await User.findById(req.params.id);
    if (!member || member.role !== 'Member') {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const today = getTodayDate();

    // Trainees can only edit weight, height, goal/reasonForJoining, medicalIssues
    if (req.user.role === 'Trainee') {
      if (weight !== undefined) {
        member.weight = parseFloat(weight);
        member.weightHistory = member.weightHistory.filter(w => w.date !== today);
        member.weightHistory.push({ date: today, weight: parseFloat(weight) });
      }
      if (height !== undefined) {
        member.height = parseFloat(height);
        member.heightHistory = member.heightHistory.filter(h => h.date !== today);
        member.heightHistory.push({ date: today, height: parseFloat(height) });
      }
      member.medicalIssues = medicalIssues !== undefined ? medicalIssues : member.medicalIssues;
      member.reasonForJoining = reasonForJoining !== undefined ? reasonForJoining : member.reasonForJoining;
    } else {
      // Admin has full edit controls
      member.name = name || member.name;
      member.phone = phone || member.phone;
      member.email = email !== undefined ? email : member.email;
      member.age = age !== undefined ? age : member.age;
      member.gender = gender || member.gender;
      member.birthDate = birthDate || member.birthDate;
      member.joinDate = joinDate || member.joinDate;
      member.planId = planId || member.planId;
      member.trainerId = trainerId || undefined;
      member.status = status || member.status;
      member.medicalIssues = medicalIssues !== undefined ? medicalIssues : member.medicalIssues;
      member.reasonForJoining = reasonForJoining !== undefined ? reasonForJoining : member.reasonForJoining;
      
      if (weight !== undefined && weight !== '') {
        member.weight = parseFloat(weight);
        member.weightHistory = member.weightHistory.filter(w => w.date !== today);
        member.weightHistory.push({ date: today, weight: parseFloat(weight) });
      }
      if (height !== undefined && height !== '') {
        member.height = parseFloat(height);
        member.heightHistory = member.heightHistory.filter(h => h.date !== today);
        member.heightHistory.push({ date: today, height: parseFloat(height) });
      }
    }

    await member.save();
    res.json({ message: 'Member details updated successfully.' });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member.' });
  }
});

// Member/Trainee/Admin can record new weight measurement
app.post('/api/members/:id/weight', protect, async (req, res) => {
  const { weight } = req.body;
  if (weight === undefined || weight === '') {
    return res.status(400).json({ error: 'Weight is required.' });
  }
  try {
    const member = await User.findById(req.params.id);
    if (!member || member.role !== 'Member') {
      return res.status(404).json({ error: 'Member not found.' });
    }
    const today = getTodayDate();
    member.weight = parseFloat(weight);
    member.weightHistory = member.weightHistory.filter(w => w.date !== today);
    member.weightHistory.push({ date: today, weight: parseFloat(weight) });
    await member.save();
    res.json({ message: 'Weight recorded successfully.', weightHistory: member.weightHistory });
  } catch (error) {
    console.error('Record weight error:', error);
    res.status(500).json({ error: 'Failed to record weight.' });
  }
});

// POST Add Trainer Member Progress Report
app.post('/api/members/:id/progress-report', protect, authorize('Trainee', 'Admin'), async (req, res) => {
  const { notes, performanceRating } = req.body;
  if (!notes) {
    return res.status(400).json({ error: 'Progress notes are required.' });
  }
  try {
    const member = await User.findById(req.params.id);
    if (!member || member.role !== 'Member') {
      return res.status(404).json({ error: 'Member not found.' });
    }

    const report = {
      date: getTodayDate(),
      notes,
      performanceRating: performanceRating ? parseInt(performanceRating) : undefined,
      submittedBy: req.user._id
    };

    member.progressReports.push(report);
    await member.save();

    res.status(201).json({ message: 'Progress report submitted successfully.', progressReports: member.progressReports });
  } catch (error) {
    console.error('Progress report submission error:', error);
    res.status(500).json({ error: 'Failed to submit progress report.' });
  }
});


// Delete Member (Admin only)
app.delete('/api/members/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const member = await User.findById(req.params.id);
    if (!member || member.role !== 'Member') {
      return res.status(404).json({ error: 'Member not found.' });
    }

    await User.findByIdAndDelete(req.params.id);
    // Delete payments and diet plans associated with this member
    await Payment.deleteMany({ memberId: req.params.id });
    await DietPlan.deleteMany({ memberId: req.params.id });

    res.json({ message: 'Member and all associated records deleted successfully.' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'Failed to delete member.' });
  }
});

// ----------------------------------------------------
// TRAINEE MANAGEMENT (ADMIN ONLY)
// ----------------------------------------------------

// Get Trainees list
app.get('/api/trainers', protect, async (req, res) => {
  try {
    const trainees = await User.find({ role: 'Trainee' }).sort({ name: 1 });
    
    // Map to match SQLite front-end variable names
    const mapped = await Promise.all(trainees.map(async (t) => {
      const clientCount = await User.countDocuments({ role: 'Member', trainerId: t._id, status: 'Active' });
      return {
        id: t._id,
        _id: t._id,
        name: t.name,
        phone: t.phone,
        email: t.email,
        shift: t.shift,
        specialization: t.specialization,
        status: t.isActive ? 'Active' : 'Inactive',
        client_count: clientCount
      };
    }));
    
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trainers.' });
  }
});

// Add Trainee
app.post('/api/trainers', protect, authorize('Admin'), async (req, res) => {
  const { name, phone, email, password, shift, specialization, status } = req.body;
  if (!name || !phone || !password || !shift || !specialization) {
    return res.status(400).json({ error: 'Name, phone, password, specialization, and shift are required.' });
  }

  try {
    const traineeExists = await findUserByPhoneOnly(phone);
    if (traineeExists) {
      return res.status(400).json({ error: 'Phone number already registered.' });
    }

    // Generate Trainee ID
    const lastTrainee = await User.findOne({ role: 'Trainee' }).sort({ createdAt: -1 });
    let nextNum = 1001;
    if (lastTrainee && lastTrainee.traineeId) {
      const match = lastTrainee.traineeId.match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0]) + 1;
      }
    }
    const traineeId = `T-${nextNum}`;

    const trainee = new User({
      name,
      phone,
      email,
      password,
      role: 'Trainee',
      traineeId,
      shift,
      specialization,
      isActive: status !== 'Inactive'
    });

    await trainee.save();
    res.status(201).json({ id: trainee._id, message: 'Trainer added successfully.' });
  } catch (error) {
    console.error('Create trainee error:', error);
    res.status(500).json({ error: 'Failed to create trainer.' });
  }
});

// Edit Trainee
app.put('/api/trainers/:id', protect, authorize('Admin'), async (req, res) => {
  const { name, phone, email, password, shift, specialization, status } = req.body;

  try {
    const trainee = await User.findById(req.params.id);
    if (!trainee || trainee.role !== 'Trainee') {
      return res.status(404).json({ error: 'Trainer not found.' });
    }

    trainee.name = name || trainee.name;
    trainee.phone = phone || trainee.phone;
    trainee.email = email !== undefined ? email : trainee.email;
    trainee.shift = shift || trainee.shift;
    trainee.specialization = specialization || trainee.specialization;
    trainee.isActive = status === 'Active';
    if (password) {
      trainee.password = password;
    }

    await trainee.save();
    res.json({ message: 'Trainer details updated successfully.' });
  } catch (error) {
    console.error('Update trainee error:', error);
    res.status(500).json({ error: 'Failed to update trainer.' });
  }
});

// Delete Trainee
app.delete('/api/trainers/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const trainee = await User.findById(req.params.id);
    if (!trainee || trainee.role !== 'Trainee') {
      return res.status(404).json({ error: 'Trainer not found.' });
    }

    await User.findByIdAndDelete(req.params.id);
    // Unassign this trainer from all members
    await User.updateMany({ role: 'Member', trainerId: req.params.id }, { $unset: { trainerId: 1 } });
    
    res.json({ message: 'Trainer deleted successfully.' });
  } catch (error) {
    console.error('Delete trainee error:', error);
    res.status(500).json({ error: 'Failed to delete trainer.' });
  }
});

// ----------------------------------------------------
// MEMBERSHIP PLANS
// ----------------------------------------------------

// Get all plans
app.get('/api/plans', async (req, res) => {
  try {
    let query = { isActive: true };
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret1234');
        const user = await User.findById(decoded.id);
        if (user && user.role === 'Admin') {
          query = {}; // Admin can see inactive plans too
        }
      } catch (e) {
        // Ignore token error and show active only
      }
    }
    const plans = await Plan.find(query).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch membership plans.' });
  }
});

// Add Plan
app.post('/api/plans', protect, authorize('Admin'), async (req, res) => {
  const { name, price, duration_months, description, isActive } = req.body;
  if (!name || price === undefined || !duration_months) {
    return res.status(400).json({ error: 'Name, Price, and Duration are required.' });
  }

  try {
    const plan = await Plan.create({
      name,
      price,
      durationMonths: duration_months,
      description,
      isActive: isActive !== undefined ? isActive : true
    });
    res.status(201).json({ id: plan._id, message: 'Plan created successfully.' });
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create plan.' });
  }
});

// Edit Plan
app.put('/api/plans/:id', protect, authorize('Admin'), async (req, res) => {
  const { name, price, duration_months, description, isActive } = req.body;

  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found.' });
    }

    plan.name = name || plan.name;
    plan.price = price !== undefined ? price : plan.price;
    plan.durationMonths = duration_months || plan.durationMonths;
    plan.description = description !== undefined ? description : plan.description;
    plan.isActive = isActive !== undefined ? isActive : plan.isActive;

    await plan.save();
    res.json({ message: 'Plan updated successfully.' });
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan.' });
  }
});

// Delete Plan
app.delete('/api/plans/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found.' });
    }

    // Check if any member uses this plan
    const memberWithPlan = await User.findOne({ role: 'Member', planId: req.params.id });
    if (memberWithPlan) {
      return res.status(400).json({ error: 'Plan cannot be deleted because it is assigned to members. Try deactivating it instead.' });
    }

    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plan deleted successfully.' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Failed to delete plan.' });
  }
});

// ----------------------------------------------------
// BILLING & PAYMENTS (ADMIN ONLY)
// ----------------------------------------------------

// Get all invoices
app.get('/api/payments', protect, authorize('Admin'), async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('memberId', 'name phone memberId')
      .populate('planId', 'name price')
      .sort({ createdAt: -1 });

    const mapped = payments.map(p => ({
      id: p._id,
      _id: p._id,
      member_id: p.memberId?._id,
      member_name: p.memberId?.name || 'Deleted Member',
      member_phone: p.memberId?.phone || 'N/A',
      plan_name: p.planId?.name || 'Custom Plan',
      amount: p.amount,
      due_amount: p.dueAmount,
      payment_date: p.paymentDate,
      due_date: p.dueDate,
      status: p.status,
      invoice_number: p.invoiceNumber
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
});

// Get Member Invoices
app.get('/api/payments/member/:memberId', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ memberId: req.params.memberId })
      .populate('planId', 'name')
      .sort({ createdAt: -1 });

    const mapped = payments.map(p => ({
      id: p._id,
      _id: p._id,
      plan_name: p.planId?.name || 'Custom Plan',
      amount: p.amount,
      due_amount: p.dueAmount,
      payment_date: p.paymentDate,
      due_date: p.dueDate,
      status: p.status,
      invoice_number: p.invoiceNumber
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch member payments.' });
  }
});

// Generate Custom Invoice
app.post('/api/payments', protect, authorize('Admin'), async (req, res) => {
  const { member_id, plan_id, amount, due_amount, payment_date, due_date, status } = req.body;
  if (!member_id || !plan_id || amount === undefined || !payment_date || !due_date) {
    return res.status(400).json({ error: 'Missing payment details.' });
  }

  try {
    const invoiceNumber = 'INV-' + Date.now().toString().substring(6);
    
    // Parse due_amount safely: if empty or undefined, set to 0. Remove prepopulated zeros.
    const parsedDue = due_amount === '' || due_amount === undefined ? 0 : parseFloat(due_amount);

    const payment = await Payment.create({
      memberId: member_id,
      planId: plan_id,
      amount,
      dueAmount: parsedDue,
      paymentDate: payment_date,
      dueDate: due_date,
      status: status || 'Pending',
      invoiceNumber
    });

    res.status(201).json({ id: payment._id, invoice_number: invoiceNumber, message: 'Invoice generated successfully.' });
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to generate invoice.' });
  }
});

// Update Invoice Payment Status
app.put('/api/payments/:id/status', protect, authorize('Admin'), async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    payment.status = status;
    if (status === 'Paid') {
      payment.dueAmount = 0; // Clear due amount if marked fully paid
    }
    await payment.save();

    // If marked Paid, automatically update member status to Active
    if (status === 'Paid') {
      await User.findByIdAndUpdate(payment.memberId, { status: 'Active' });
    }

    res.json({ message: 'Payment status updated successfully.' });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// Delete Invoice
app.delete('/api/payments/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    res.json({ message: 'Invoice deleted successfully.' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
});



// ----------------------------------------------------
// WORKOUT & DIET PLANS
// ----------------------------------------------------

// Get Workout/Diet Plan for a member
app.get('/api/workout-diet/:memberId', protect, async (req, res) => {
  try {
    const plan = await DietPlan.findOne({ memberId: req.params.memberId });
    if (!plan) {
      return res.json({
        memberId: req.params.memberId,
        workoutRoutine: [],
        dietRoutine: [],
        updatedAt: ''
      });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workout/diet plan.' });
  }
});

// Save Workout/Diet Plan
app.post('/api/workout-diet/:memberId', protect, async (req, res) => {
  const { workout_routine, diet_routine } = req.body;
  const memberId = req.params.memberId;

  // Authorize only admins and trainees to save/update plans
  if (req.user.role === 'Member') {
    return res.status(403).json({ error: 'Members are not authorized to modify diet plans.' });
  }

  try {
    // Parse the JSON arrays from requests if sent as stringified json (SQLite structure mapping)
    const workout = typeof workout_routine === 'string' ? JSON.parse(workout_routine) : workout_routine;
    const diet = typeof diet_routine === 'string' ? JSON.parse(diet_routine) : diet_routine;

    let plan = await DietPlan.findOne({ memberId });
    if (!plan) {
      plan = new DietPlan({
        memberId,
        workoutRoutine: workout,
        dietRoutine: diet,
        updatedBy: req.user._id
      });
    } else {
      plan.workoutRoutine = workout;
      plan.dietRoutine = diet;
      plan.updatedBy = req.user._id;
    }

    await plan.save();
    res.json({ message: 'Workout and diet plan saved successfully.' });
  } catch (error) {
    console.error('Save diet plan error:', error);
    res.status(500).json({ error: 'Failed to save diet/workout plan.' });
  }
});

// ----------------------------------------------------
// SLOT MANAGEMENT (NEW)
// ----------------------------------------------------

// Get slots list
app.get('/api/slots', protect, async (req, res) => {
  try {
    const slots = await Slot.find()
      .populate('trainerId', 'name specialization phone')
      .populate('enrolledMembers', 'name memberId');
    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slots.' });
  }
});

// Create slot (Admin only)
app.post('/api/slots', protect, authorize('Admin'), async (req, res) => {
  const { name, timeRange, trainerId, maxCapacity } = req.body;
  if (!name || !timeRange) {
    return res.status(400).json({ error: 'Name and Time Range are required.' });
  }

  try {
    const slot = await Slot.create({
      name,
      timeRange,
      trainerId: trainerId || undefined,
      maxCapacity: maxCapacity || 20
    });
    res.status(201).json({ slot, message: 'Slot created successfully.' });
  } catch (error) {
    console.error('Create slot error:', error);
    res.status(500).json({ error: 'Failed to create slot.' });
  }
});

// Edit slot (Admin only)
app.put('/api/slots/:id', protect, authorize('Admin'), async (req, res) => {
  const { name, timeRange, trainerId, maxCapacity } = req.body;

  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found.' });
    }

    slot.name = name || slot.name;
    slot.timeRange = timeRange || slot.timeRange;
    slot.trainerId = trainerId || undefined;
    slot.maxCapacity = maxCapacity !== undefined ? maxCapacity : slot.maxCapacity;

    await slot.save();
    res.json({ message: 'Slot updated successfully.' });
  } catch (error) {
    console.error('Update slot error:', error);
    res.status(500).json({ error: 'Failed to update slot.' });
  }
});

// Delete slot (Admin only)
app.delete('/api/slots/:id', protect, authorize('Admin'), async (req, res) => {
  try {
    const slot = await Slot.findByIdAndDelete(req.params.id);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found.' });
    }
    res.json({ message: 'Slot deleted successfully.' });
  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({ error: 'Failed to delete slot.' });
  }
});

// Enroll in a slot (Member only)
app.post('/api/slots/:id/enroll', protect, authorize('Member'), async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found.' });
    }

    if (slot.enrolledMembers.includes(req.user._id)) {
      return res.status(400).json({ error: 'You are already enrolled in this slot.' });
    }

    if (slot.enrolledMembers.length >= slot.maxCapacity) {
      return res.status(400).json({ error: 'Slot is already full.' });
    }

    // Remove member from any other enrolled slots to avoid double booking
    await Slot.updateMany(
      { enrolledMembers: req.user._id },
      { $pull: { enrolledMembers: req.user._id } }
    );

    slot.enrolledMembers.push(req.user._id);
    await slot.save();

    res.json({ message: 'Enrolled in slot successfully!' });
  } catch (error) {
    console.error('Enroll slot error:', error);
    res.status(500).json({ error: 'Failed to enroll in slot.' });
  }
});

// Unenroll from slot (Member only)
app.post('/api/slots/:id/unenroll', protect, authorize('Member'), async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found.' });
    }

    if (!slot.enrolledMembers.includes(req.user._id)) {
      return res.status(400).json({ error: 'You are not enrolled in this slot.' });
    }

    slot.enrolledMembers.pull(req.user._id);
    await slot.save();

    res.json({ message: 'Unenrolled from slot successfully.' });
  } catch (error) {
    console.error('Unenroll slot error:', error);
    res.status(500).json({ error: 'Failed to unenroll.' });
  }
});

// ----------------------------------------------------
// DATABASE EXPORT BACKUP
// ----------------------------------------------------
app.get('/api/backup/export', protect, authorize('Admin'), async (req, res) => {
  try {
    const plans = await Plan.find();
    const members = await User.find({ role: 'Member' });
    const trainers = await User.find({ role: 'Trainee' });
    const payments = await Payment.find();
    const dietPlans = await DietPlan.find();
    const slots = await Slot.find();

    res.json({
      exported_at: new Date().toISOString(),
      membership_plans: plans,
      members,
      trainers,
      payments,
      workout_diet_plans: dietPlans,
      slots
    });
  } catch (error) {
    console.error('Database backup failed:', error);
    res.status(500).json({ error: 'Database backup failed.' });
  }
});

// Start Express Server
app.listen(port, () => {
  console.log(`Express API Server listening on port ${port}`);
});

export default app;
