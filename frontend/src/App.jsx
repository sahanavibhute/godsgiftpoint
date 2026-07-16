import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell, LineChart, Line } from 'recharts';
import {
  Dumbbell, Users, CreditCard, Activity, Plus, Search, Trash2, Edit,
  AlertTriangle, Printer, X, Download, UserPlus, FileText, CheckCircle,
  Clock, ArrowRight, ShieldAlert, ChevronRight, TrendingUp, Settings,
  Calendar, LogOut, BookOpen, User as UserIcon, Lock, Phone, Info, MapPin, Bell, Menu, Shield
} from 'lucide-react';
import { api } from './api';



const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Reusable modal component rendering to document.body via Portals to prevent clipping and support exit animations
function PortalModal({ isOpen, children, zIndex = 200 }) {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop" 
          style={{ zIndex }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const cached = localStorage.getItem('gymUser');
    if (!cached) return null;
    try {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.token) {
        // Safe base64 token expiry check
        const parts = parsed.token.split('.');
        if (parts.length === 3) {
          const payloadBase64 = parts[1];
          const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
          const payload = JSON.parse(decodedJson);
          if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            localStorage.removeItem('gymUser');
            return null;
          }
        }
      }
      return parsed;
    } catch (e) {
      localStorage.removeItem('gymUser');
      return null;
    }
  });

  // Global listener for session expiration event
  useEffect(() => {
    const handleAuthExpired = () => {
      handleLogout();
      showError('Your session has expired. Please login again.');
    };
    window.addEventListener('auth-session-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-session-expired', handleAuthExpired);
    };
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  // Shared state for invoice form presets (from member profile renewal)
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceFormPreset, setInvoiceFormPreset] = useState(null);

  // Sidebar Toggling state (Mobile)
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Landing Page / Auth state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); 
  const [authRole, setAuthRole] = useState('Admin'); 

  // Notification Drawer state
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsRead, setNotificationsRead] = useState(false);

  const toggleNotifications = () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) {
      setNotificationsRead(true);
    }
  };

  // Auth Forms data
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Member Registration Forms data
  const [regData, setRegData] = useState({
    name: '', phone: '', email: '', password: '', age: '', gender: 'Male',
    birthDate: '', joinDate: '', planId: '', medicalIssues: '', reasonForJoining: 'Fitness',
    weight: '', height: ''
  });
  
  // Forgot Password Forms data
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');



  // Loaded database lists
  const [dashboardData, setDashboardData] = useState(null);
  const [members, setMembers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [payments, setPayments] = useState([]);
  const [slots, setSlots] = useState([]);
  const [memberPayments, setMemberPayments] = useState([]);
  const [memberDiet, setMemberDiet] = useState(null);

  // Health tracking state (Member)
  const [newWeight, setNewWeight] = useState('');

  // Loading state
  const [loading, setLoading] = useState(false);

  // Auto calculate age
  useEffect(() => {
    if (regData.birthDate) {
      const birth = new Date(regData.birthDate);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        calculatedAge--;
      }
      setRegData(prev => ({ ...prev, age: calculatedAge }));
    }
  }, [regData.birthDate]);

  // Load plans publicly
  useEffect(() => {
    api.getPlans().then(setPlans).catch(err => console.error(err));
  }, []);



  // Compile Dynamic System Notifications in React
  const compileNotifications = (user, dash, mems, pays, diets) => {
    const list = [];
    if (!user) return;

    if (user.role === 'Admin') {
      const unpaidCount = pays.filter(p => p.status !== 'Paid').length;
      if (unpaidCount > 0) {
        list.push({ id: 1, type: 'warning', text: `Billing Alert: You have ${unpaidCount} outstanding pending/overdue invoices.` });
      }
      const expiredCount = mems.filter(m => m.status === 'Expired').length;
      if (expiredCount > 0) {
        list.push({ id: 2, type: 'error', text: `Membership Expiry Alert: ${expiredCount} member accounts are currently expired.` });
      }
      const pendingCount = mems.filter(m => m.status === 'Pending').length;
      if (pendingCount > 0) {
        list.push({ id: 3, type: 'info', text: `Registration: ${pendingCount} signups are pending OTP verification.` });
      }
    } else if (user.role === 'Trainee') {
      const missingDietCount = mems.filter(m => !m.dietPlan).length; 
      if (missingDietCount > 0) {
        list.push({ id: 4, type: 'info', text: `Action Required: ${missingDietCount} assigned clients require diet/workout routines.` });
      }
    } else if (user.role === 'Member') {
      if (user.status === 'Expired') {
        list.push({ id: 5, type: 'error', text: 'Membership Expiry Alert: Your membership has expired. Please contact front desk.' });
      }
      const unpaidInvoice = memberPayments.find(p => p.status !== 'Paid');
      if (unpaidInvoice) {
        list.push({ id: 6, type: 'warning', text: `Outstanding Invoice: A pending subscription payment is due (Invoice ${unpaidInvoice.invoice_number}).` });
      }
      if (memberDiet && memberDiet.updatedAt) {
        list.push({ id: 7, type: 'info', text: 'Diet Routine: Your personal trainer has updated your diet schedules.' });
      }
    }

    setNotifications(prev => {
      const prevTexts = prev.map(n => n.text).join('|');
      const newTexts = list.map(n => n.text).join('|');
      if (prevTexts !== newTexts) {
        setNotificationsRead(false);
      }
      return list;
    });
  };

  // Fetch dashboard data in parallel
  const loadDashboardData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      if (currentUser.role === 'Admin') {
        const [dbDash, dbMembers, dbTrainers, dbPlans, dbPayments, dbSlots] = await Promise.all([
          api.getDashboard(),
          api.getMembers(),
          api.getTrainers(),
          api.getPlans(),
          api.getPayments(),
          api.getSlots()
        ]);

        setDashboardData(dbDash);
        setMembers(dbMembers);
        setTrainers(dbTrainers);
        setPlans(dbPlans);
        setPayments(dbPayments);
        setSlots(dbSlots);
        compileNotifications(currentUser, dbDash, dbMembers, dbPayments, null);
      } else if (currentUser.role === 'Trainee') {
        const [dbMembers, dbSlots] = await Promise.all([
          api.getMembers(),
          api.getSlots()
        ]);
        setMembers(dbMembers);
        setSlots(dbSlots);
        compileNotifications(currentUser, null, dbMembers, [], null);
      } else if (currentUser.role === 'Member') {
        const [dbPayments, dbDiet, dbSlots, dbPlans, freshUser] = await Promise.all([
          api.getMemberPayments(currentUser._id),
          api.getWorkoutDiet(currentUser._id),
          api.getSlots(),
          api.getPlans(),
          api.getMember(currentUser._id)
        ]);

        setCurrentUser(freshUser);
        localStorage.setItem('gymUser', JSON.stringify(freshUser));
        setMemberPayments(dbPayments);
        setMemberDiet(dbDiet);
        setSlots(dbSlots);
        setPlans(dbPlans);
        compileNotifications(freshUser, null, [], dbPayments, dbDiet);
      }
      setGlobalError('');
    } catch (err) {
      console.error(err);
      if (err.message.includes('Not authorized') || err.message.includes('token failed') || err.message.includes('no token') || err.message.includes('user not found')) {
        handleLogout();
        showError('Session expired or invalid credentials. Please log in again.');
      } else {
        setGlobalError('Failed to load data. Connection issue with backend.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Lightweight refresh helpers to instantly sync specific lists after action submits
  const refreshMembers = async () => {
    try {
      const dbMembers = await api.getMembers();
      setMembers(dbMembers);
      // Silently update dashboard metrics in the background
      api.getDashboard().then(setDashboardData).catch(console.error);
    } catch (err) {
      console.error('Failed to refresh members:', err);
    }
  };

  const refreshTrainers = async () => {
    try {
      const dbTrainers = await api.getTrainers();
      setTrainers(dbTrainers);
      api.getDashboard().then(setDashboardData).catch(console.error);
    } catch (err) {
      console.error('Failed to refresh trainers:', err);
    }
  };

  const refreshPlans = async () => {
    try {
      const dbPlans = await api.getPlans();
      setPlans(dbPlans);
    } catch (err) {
      console.error('Failed to refresh plans:', err);
    }
  };

  const refreshPayments = async () => {
    try {
      const dbPayments = await api.getPayments();
      setPayments(dbPayments);
      api.getDashboard().then(setDashboardData).catch(console.error);
    } catch (err) {
      console.error('Failed to refresh payments:', err);
    }
  };

  const refreshSlots = async () => {
    try {
      const dbSlots = await api.getSlots();
      setSlots(dbSlots);
    } catch (err) {
      console.error('Failed to refresh slots:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [currentUser?._id]);

  const showSuccess = (msg) => {
    setGlobalSuccess(msg);
    setTimeout(() => setGlobalSuccess(''), 4000);
  };

  const showError = (msg) => {
    setGlobalError(msg);
    setTimeout(() => setGlobalError(''), 5000);
  };

  // ----------------------------------------------------
  // AUTHENTICATION LOGIC
  // ----------------------------------------------------

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginPhone || !loginPassword) return;
    setLoading(true);
    try {
      const data = await api.login(loginPhone, loginPassword, authRole);
      localStorage.setItem('gymUser', JSON.stringify(data));
      setCurrentUser(data);
      setShowAuthModal(false);
      setLoginPhone('');
      setLoginPassword('');
      showSuccess(`Welcome back, ${data.name}!`);
    } catch (err) {
      showError(err.message || 'Invalid credentials or connection issue.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.registerMember(regData);
      localStorage.setItem('gymUser', JSON.stringify(response));
      setCurrentUser(response);
      setShowAuthModal(false);
      
      // Reset state
      setRegData({
        name: '', phone: '', email: '', password: '', age: '', gender: 'Male',
        birthDate: '', joinDate: '', planId: '', medicalIssues: '', reasonForJoining: 'Fitness',
        weight: '', height: ''
      });

      showSuccess('Registration successful! Welcome to God Gifts Fitness Point.');
    } catch (err) {
      showError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendForgotOtp = async (e) => {
    e.preventDefault();
    if (!forgotPhone) return;
    setLoading(true);
    try {
      await api.sendForgotPasswordOtp(forgotPhone, authRole);
      setAuthMode('reset-password');
      showSuccess('Password reset OTP sent.');
    } catch (err) {
      showError(err.message || 'Forgot password request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotPhone || !forgotOtp || !newPassword) return;
    setLoading(true);
    try {
      await api.resetPassword(forgotPhone, authRole, forgotOtp, newPassword);
      setAuthMode('login');
      setForgotPhone('');
      setForgotOtp('');
      setNewPassword('');
      showSuccess('Password reset successful. Please login.');
    } catch (err) {
      showError(err.message || 'Reset password failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gymUser');
    setCurrentUser(null);
    setDashboardData(null);
    setMembers([]);
    setTrainers([]);
    setPayments([]);
    showSuccess('Successfully logged out.');
  };

  // Record Weight Progress (Member Dashboard)
  const handleRecordWeight = async (e) => {
    e.preventDefault();
    if (!newWeight) return;
    try {
      const res = await api.logMemberWeight(currentUser._id, newWeight);
      setNewWeight('');
      showSuccess('Weight progress updated!');
      loadDashboardData();
    } catch (err) {
      showError(err.message);
    }
  };

  // ----------------------------------------------------
  // 1. LANDING PAGE
  // ----------------------------------------------------
  if (!currentUser) {
    return (
      <div className="landing-page" style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #0c0e18, #05060b)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
        fontFamily: 'Outfit, sans-serif'
      }}>
        {/* Global Notifications */}
        <AnimatePresence>
          {globalError && (
            <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="alert alert-error" style={{ position: 'fixed', top: '20px', zIndex: 1000, background: 'var(--status-expired)', color: '#fff', padding: '1rem 2rem', borderRadius: '8px', boxShadow: '0 4px 20px var(--status-expired-glow)' }}>
              <AlertTriangle size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              {globalError}
            </motion.div>
          )}
          {globalSuccess && (
            <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="alert alert-success" style={{ position: 'fixed', top: '20px', zIndex: 1000, background: 'var(--status-active)', color: '#000', padding: '1rem 2rem', borderRadius: '8px', boxShadow: '0 4px 20px var(--status-active-glow)', fontWeight: 600 }}>
              <CheckCircle size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              {globalSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '450px' }}
        >
          {/* Top Badge */}
          <div className="landing-badge">
            <Dumbbell size={14} color="#ff3b30" />
            <span>God Gifts Fitness Point - Admin Console</span>
          </div>

          {/* Brand Logo */}
          <img 
            src="/logo.png" 
            alt="God Gifts Fitness Point Logo" 
            style={{ 
              width: '400px', 
              maxWidth: '85%', 
              height: 'auto', 
              marginTop: '2.5rem',
              marginBottom: '2.5rem',
              filter: 'drop-shadow(0 0 20px rgba(255, 170, 0, 0.25))' 
            }} 
          />

          {/* Inline Admin Login Form */}
          <div className="glass-card" style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '2.5rem 2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1.5rem', textAlign: 'center', color: '#fff' }}>Admin Login</h2>
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.9rem', color: '#94a3b8' }}>User ID / Phone</label>
                <input type="text" value={loginPhone} onChange={(e) => setLoginPhone(e.target.value)} required placeholder="enter user id" style={{ width: '100%', height: '42px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Password</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required placeholder="enter password" style={{ width: '100%' }} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ADMIN DASHBOARD PANELS
  // ----------------------------------------------------

  function AdminDashboardView() {
    if (!dashboardData) return <div>Loading Admin Dashboard metrics...</div>;

    const { metrics, recentInvoices, planDistribution, revenueTrends } = dashboardData;

    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Metric Grid */}
        <div className="metrics-grid">
          <div className="metric-card glass-card glow-card-orange">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 85, 0, 0.12)', padding: '0.8rem', borderRadius: '8px' }}><Users size={24} color="var(--accent-orange)" /></div>
              <div>
                <h3 style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Total Members</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{metrics.totalMembers}</div>
              </div>
            </div>
          </div>
          <div className="metric-card glass-card glow-card-green">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(0, 255, 170, 0.12)', padding: '0.8rem', borderRadius: '8px' }}><CheckCircle size={24} color="var(--status-active)" /></div>
              <div>
                <h3 style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Active Members</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>{metrics.activeMembers}</div>
              </div>
            </div>
          </div>
          <div className="metric-card glass-card glow-card-orange">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(255, 85, 0, 0.12)', padding: '0.8rem', borderRadius: '8px' }}><TrendingUp size={24} color="var(--accent-orange)" /></div>
              <div>
                <h3 style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Monthly Income</h3>
                <div style={{ fontSize: '1.8rem', fontWeight: 800 }}>₹{metrics.monthlyRevenue}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Membership Health Summary */}
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-blue)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Membership Health Status</h3>
          <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>Active Members: {metrics.activeMembers} / Expired Profiles: {metrics.expiredMembers}</div>
        </div>

        {/* Charts */}
        <div>
          {/* Revenue Chart */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 700 }}>Monthly Revenue Growth (INR)</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <AreaChart data={revenueTrends}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-orange)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="var(--accent-orange)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: '#0c0e18', border: '1px solid var(--glass-border)', color: '#fff' }} />
                  <Area type="monotone" dataKey="amount" stroke="var(--accent-orange)" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 2. MEMBER DIRECTORY VIEW
  // ----------------------------------------------------
  function MemberDirectoryView() {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [showFormModal, setShowFormModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);

    const [selectedMember, setSelectedMember] = useState(null);
    const [selectedMemberPayments, setSelectedMemberPayments] = useState([]);
    const [selectedMemberDiet, setSelectedMemberDiet] = useState(null);

    const [formData, setFormData] = useState({
      id: '', name: '', phone: '', email: '', password: '', age: '', gender: 'Male',
      birthDate: '', joinDate: '', planId: '', trainerId: '', status: 'Active',
      medicalIssues: '', reasonForJoining: 'Fitness', weight: '', height: ''
    });

    const openCreateModal = () => {
      setFormData({
        id: '', name: '', phone: '', email: '', password: '', age: '', gender: 'Male',
        birthDate: '', joinDate: getTodayDate(), planId: plans[0]?._id || '', trainerId: '', status: 'Active',
        medicalIssues: '', reasonForJoining: 'Fitness', weight: '', height: ''
      });
      setShowFormModal(true);
    };

    const openEditModal = (m) => {
      setFormData({
        id: m._id, name: m.name, phone: m.phone, email: m.email || '', password: '', age: m.age || '', gender: m.gender || 'Male',
        birthDate: m.birthDate || '', joinDate: m.joinDate || getTodayDate(), planId: m.planId?._id || '', trainerId: m.trainerId?._id || '', status: m.status || 'Active',
        medicalIssues: m.medicalIssues || '', reasonForJoining: m.reasonForJoining || 'Fitness', weight: m.weight || '', height: m.height || ''
      });
      setShowFormModal(true);
    };

    const handleFormSubmit = async (e) => {
      e.preventDefault();
      try {
        if (formData.id) {
          await api.updateMember(formData.id, formData);
          showSuccess('Member details updated.');
        } else {
          await api.createMember(formData);
          showSuccess('Member profile created.');
        }
        setShowFormModal(false);
        refreshMembers();
      } catch (err) {
        showError(err.message || 'Action failed.');
      }
    };

    const handleDeleteMember = async (id) => {
      if (!window.confirm('Are you sure you want to delete this member? All records will be cleared.')) return;
      try {
        await api.deleteMember(id);
        showSuccess('Member permanently deleted.');
        setShowDetailModal(false);
        refreshMembers();
      } catch (err) {
        showError(err.message);
      }
    };

    const viewMemberDetails = async (m) => {
      setSelectedMember(m);
      try {
        const memPays = await api.getMemberPayments(m._id);
        const memD = await api.getWorkoutDiet(m._id);
        setSelectedMemberPayments(memPays);
        setSelectedMemberDiet(memD);
        setShowDetailModal(true);
      } catch (err) {
        showError(err.message);
      }
    };

    const filtered = members.filter(m => {
      const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.phone.includes(searchQuery) || (m.memberId && m.memberId.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchFilter = statusFilter === 'All' || m.status === statusFilter;
      return matchSearch && matchFilter;
    });

    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Gym Member Directory</h2>
          <button onClick={openCreateModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><UserPlus size={16} /> Add Member</button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, position: 'relative', minWidth: '200px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input type="text" placeholder="Search members by name, ID or mobile..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 'auto', minWidth: '150px' }}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        {/* Member Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m._id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent-orange)' }}>{m.memberId}</td>
                  <td>{m.name}</td>
                  <td>{m.phone}</td>
                  <td>{m.planId?.name || 'Custom Plan'}</td>
                  <td>
                    <span className={`badge ${
                      m.status === 'Active' ? 'badge-active' : m.status === 'Pending' ? 'badge-pending' : 'badge-expired'
                    }`}>{m.status}</span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => viewMemberDetails(m)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Profile</button>
                    <button onClick={() => openEditModal(m)} className="btn btn-secondary" style={{ padding: '0.4rem' }}><Edit size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal: Create/Edit Form */}
        <PortalModal isOpen={showFormModal}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="glass-card" 
            style={{ 
              width: '100%', maxWidth: '650px', 
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, 
              background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
               <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Member Details' : 'Register New Member'}</h3>
              <button onClick={() => setShowFormModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>
              <form onSubmit={handleFormSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Full Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Phone Number</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required autoComplete="new-phone" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Birth Date</label>
                  <input type="date" value={formData.birthDate} onChange={(e) => setFormData({...formData, birthDate: e.target.value})} required style={{ height: '42px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Join Date</label>
                  <input type="date" value={formData.joinDate} onChange={(e) => setFormData({...formData, joinDate: e.target.value})} style={{ height: '42px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Gender</label>
                  <select value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Status</label>
                  <select value={formData.status === 'Active' ? 'Paid' : formData.status} onChange={(e) => setFormData({...formData, status: e.target.value === 'Paid' ? 'Active' : e.target.value})}>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Weight (kg)</label>
                  <input type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Height (cm)</label>
                  <input type="number" value={formData.height} onChange={(e) => setFormData({...formData, height: e.target.value})} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Assign Membership Plan</label>
                  <select value={formData.planId} onChange={(e) => setFormData({...formData, planId: e.target.value})} required>
                    {plans.map(p => (
                      <option key={p._id} value={p._id}>{p.name} - ₹{p.price}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Assign Personal Trainer (Optional)</label>
                  <select value={formData.trainerId} onChange={(e) => setFormData({...formData, trainerId: e.target.value})}>
                    <option value="">No Personal Trainer</option>
                    {trainers.map(t => (
                      <option key={t._id} value={t._id}>{t.name} ({t.specialization})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Medical History / Issues</label>
                  <input type="text" value={formData.medicalIssues} onChange={(e) => setFormData({...formData, medicalIssues: e.target.value})} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Goal</label>
                  <select value={formData.reasonForJoining} onChange={(e) => setFormData({...formData, reasonForJoining: e.target.value})}>
                    <option>Weight Loss</option>
                    <option>Weight Gain</option>
                    <option>Muscle Building</option>
                    <option>Fitness</option>
                    <option>Cardio</option>
                    <option>General Health</option>
                    <option>Custom</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>Save Member Profile</button>
              </form>
            </div>
          </motion.div>
        </PortalModal>

        {/* Modal: View Member Detail Profile */}
        <PortalModal isOpen={showDetailModal && !!selectedMember}>
          {selectedMember && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="glass-card" 
              style={{ 
                width: '100%', maxWidth: '750px', 
                maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, 
                background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Profile: {selectedMember.name} ({selectedMember.memberId})</h3>
                <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
              </div>
              <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <h4 style={{ color: 'var(--accent-orange)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Biometrics & Contact</h4>
                    <p style={{ margin: '0.3rem 0' }}><strong>Mobile:</strong> {selectedMember.phone}</p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Email:</strong> {selectedMember.email || 'N/A'}</p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Gender / Age:</strong> {selectedMember.gender} / {selectedMember.age || 'N/A'} yrs</p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Weight / Height:</strong> {selectedMember.weight || 'N/A'} kg / {selectedMember.height || 'N/A'} cm</p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Medical History:</strong> {selectedMember.medicalIssues || 'None'}</p>
                  </div>
                  <div>
                    <h4 style={{ color: 'var(--accent-orange)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Membership Info</h4>
                    <p style={{ margin: '0.3rem 0' }}><strong>Status:</strong> <span style={{ color: selectedMember.status === 'Active' ? 'var(--status-active)' : 'var(--status-expired)' }}>{selectedMember.status}</span></p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Plan Assigned:</strong> {selectedMember.planId?.name || 'N/A'}</p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Personal Trainer:</strong> {selectedMember.trainerId?.name || 'None'}</p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Joining Date:</strong> {selectedMember.joinDate}</p>
                    <p style={{ margin: '0.3rem 0' }}><strong>Reason for Joining:</strong> {selectedMember.reasonForJoining}</p>
                  </div>
                </div>

                {/* Workout/Diet routine */}
                <div style={{ marginBottom: '1.5rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px' }}>
                  <h4 style={{ color: 'var(--accent-blue)', marginBottom: '0.5rem' }}><BookOpen size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Active Diet Routine</h4>
                  {selectedMemberDiet && selectedMemberDiet.dietRoutine?.length > 0 ? (
                    selectedMemberDiet.dietRoutine.map((d, index) => (
                      <p key={index} style={{ fontSize: '0.9rem', margin: '0.2rem 0' }}><strong>{d.meal}:</strong> {d.items}</p>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>No diet plan currently active.</span>
                  )}
                </div>

                {/* Payments History */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ color: 'var(--status-active)', marginBottom: '0.5rem' }}><CreditCard size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Invoices & Dues History</h4>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {selectedMemberPayments.length === 0 ? (
                      <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No payment invoices generated.</span>
                    ) : (
                      selectedMemberPayments.map(p => (
                        <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', marginBottom: '0.4rem', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                          <span><strong>{p.invoice_number}</strong> ({p.plan_name})</span>
                          <span>₹{p.amount} ({p.status})</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', flexWrap: 'wrap', gap: '0.8rem' }}>
                  <button onClick={() => handleDeleteMember(selectedMember._id)} className="btn" style={{ background: 'rgba(255, 42, 95, 0.15)', color: 'var(--status-expired)', fontWeight: 600 }}><Trash2 size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Delete Member</button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => {
                      setInvoiceFormPreset({
                        member_id: selectedMember._id,
                        plan_id: selectedMember.planId?._id || ''
                      });
                      setShowInvoiceForm(true);
                      setActiveTab('payments');
                      setShowDetailModal(false);
                    }} className="btn btn-primary" style={{ background: 'var(--status-active)', color: '#000', fontWeight: 700 }}>Renew Membership</button>
                    <button onClick={() => setShowDetailModal(false)} className="btn btn-secondary">Close Details</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </PortalModal>
      </div>
    );
  }

  // ----------------------------------------------------
  // 3. TRAINEE MANAGEMENT PANEL
  // ----------------------------------------------------
  function TraineeManagementView() {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
      id: '', name: '', phone: '', email: '', password: '', shift: 'Morning', specialization: '', status: 'Active'
    });

    const handleFormSubmit = async (e) => {
      e.preventDefault();
      try {
        if (formData.id) {
          await api.updateTrainer(formData.id, formData);
          showSuccess('Trainer details updated.');
        } else {
          await api.createTrainer(formData);
          showSuccess('Trainer added successfully.');
        }
        setShowForm(false);
        refreshTrainers();
      } catch (err) {
        showError(err.message || 'Action failed.');
      }
    };

    const handleDeleteTrainer = async (id) => {
      if (!window.confirm('Are you sure you want to delete this Trainer? All assigned members will be unassigned.')) return;
      try {
        await api.deleteTrainer(id);
        showSuccess('Trainer deleted successfully.');
        refreshTrainers();
      } catch (err) {
        showError(err.message);
      }
    };

    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Trainee Coaches</h2>
          <button onClick={() => {
            setFormData({ id: '', name: '', phone: '', email: '', password: '', shift: 'Morning', specialization: '', status: 'Active' });
            setShowForm(true);
          }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={16} /> Add Trainer</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {trainers.map(t => (
            <div key={t._id} className="glass-card glow-card-blue" style={{ background: 'rgba(255, 255, 255, 0.01)', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{t.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)' }}>{t.specialization}</span>
                  </div>
                  <span className={`badge ${t.status === 'Active' ? 'badge-active' : 'badge-expired'}`}>{t.status}</span>
                </div>
                <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Phone:</strong> {t.phone}</p>
                <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Email:</strong> {t.email || 'N/A'}</p>
                <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Shift:</strong> {t.shift}</p>
                <p style={{ margin: '0.3rem 0', fontSize: '0.9rem' }}><strong>Assigned Clients:</strong> {t.client_count} active</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button onClick={() => {
                  setFormData({ id: t._id, name: t.name, phone: t.phone, email: t.email || '', password: '', shift: t.shift, specialization: t.specialization, status: t.status });
                  setShowForm(true);
                }} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}>Edit Coach</button>
                <button onClick={() => handleDeleteTrainer(t._id)} className="btn btn-secondary" style={{ padding: '0.5rem', color: 'var(--status-expired)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Create/Edit Form modal */}
        <PortalModal isOpen={showForm}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="glass-card" 
            style={{ 
              width: '100%', maxWidth: '500px', 
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, 
              background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Trainer Details' : 'Add Trainer / Trainee'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Trainer Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Mobile Number</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required autoComplete="new-phone" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Specialization</label>
                  <input type="text" value={formData.specialization} onChange={(e) => setFormData({...formData, specialization: e.target.value})} required placeholder="Bodybuilding, Strength, HIIT" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Shift</label>
                  <select value={formData.shift} onChange={(e) => setFormData({...formData, shift: e.target.value})}>
                    <option>Morning</option>
                    <option>Evening</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Trainer Details</button>
              </form>
            </div>
          </motion.div>
        </PortalModal>
      </div>
    );
  }

  // ----------------------------------------------------
  // 4. MEMBERSHIP PLANS MANAGEMENT PANEL
  // ----------------------------------------------------
  function PlansManagementView() {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
      id: '', name: '', price: '', duration_months: 1, description: '', isActive: true
    });

    const handleFormSubmit = async (e) => {
      e.preventDefault();
      try {
        if (formData.id) {
          await api.updatePlan(formData.id, formData);
          showSuccess('Plan modified.');
        } else {
          await api.createPlan(formData);
          showSuccess('Plan created.');
        }
        setShowForm(false);
        refreshPlans();
      } catch (err) {
        showError(err.message);
      }
    };

    const handleDeletePlan = async (id) => {
      if (!window.confirm('Delete this membership plan?')) return;
      try {
        await api.deletePlan(id);
        showSuccess('Plan deleted successfully.');
        refreshPlans();
      } catch (err) {
        showError(err.message);
      }
    };

    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Membership Plans & Discount Control</h2>
          <button onClick={() => {
            setFormData({ id: '', name: '', price: '', duration_months: 1, description: '', isActive: true });
            setShowForm(true);
          }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={16} /> Add Plan</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {plans.map(p => (
            <div key={p._id} className="glass-card glow-card-orange" style={{ background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-orange)', margin: 0 }}>{p.name}</h3>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '4px', 
                    background: p.isActive !== false ? 'rgba(0, 225, 255, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                    color: p.isActive !== false ? 'var(--accent-blue)' : 'var(--status-expired)',
                    border: `1px solid ${p.isActive !== false ? 'rgba(0, 225, 255, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                  }}>
                    {p.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.8rem' }}>₹{p.price} <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>/ {p.durationMonths} Month(s)</span></div>
                <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '1rem', minHeight: '40px' }}>{p.description || 'No plan description provided.'}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button onClick={() => {
                  setFormData({ id: p._id, name: p.name, price: p.price, duration_months: p.durationMonths, description: p.description || '', isActive: p.isActive !== false });
                  setShowForm(true);
                }} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}>Edit Plan</button>
                <button onClick={() => handleDeletePlan(p._id)} className="btn btn-secondary" style={{ padding: '0.5rem', color: 'var(--status-expired)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        <PortalModal isOpen={showForm}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="glass-card" 
            style={{ 
              width: '100%', maxWidth: '450px', 
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, 
              background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Membership Plan' : 'Create New Plan'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Plan Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required placeholder="Monthly Basic" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Price (INR)</label>
                  <input type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required placeholder="1500" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Duration (Months)</label>
                  <input type="number" value={formData.duration_months} onChange={(e) => setFormData({...formData, duration_months: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Description</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} placeholder="Equipment access description..." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id="isActive" 
                    checked={formData.isActive !== false} 
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})} 
                    style={{ width: 'auto', height: 'auto', cursor: 'pointer' }}
                  />
                  <label htmlFor="isActive" style={{ fontSize: '0.9rem', color: '#fff', cursor: 'pointer' }}>Active (Show in Registration / Invoices)</label>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Plan Details</button>
              </form>
            </div>
          </motion.div>
        </PortalModal>
      </div>
    );
  }

  // ----------------------------------------------------
  // 5. BILLING & PAYMENTS PANEL
  // ----------------------------------------------------
  function PaymentsManagementView() {
    const [showReceipt, setShowReceipt] = useState(false);
    const [activeReceipt, setActiveReceipt] = useState(null);
    const [applyDiscount, setApplyDiscount] = useState(false);

    const [formData, setFormData] = useState({
      member_id: '', plan_id: '', amount: '', due_amount: '', payment_date: getTodayDate(), due_date: '', status: 'Paid'
    });

    // Auto set default plan pricing, auto-calculate dates and handle discounts
    useEffect(() => {
      if (formData.plan_id) {
        const chosenPlan = plans.find(p => p._id === formData.plan_id);
        if (chosenPlan) {
          let price = chosenPlan.price;
          if (applyDiscount) {
            price = price * 0.8; 
          }
          
          // Auto calculate due date based on payment date + plan duration
          const baseDate = formData.payment_date ? new Date(formData.payment_date) : new Date();
          baseDate.setMonth(baseDate.getMonth() + chosenPlan.durationMonths);
          const autoDueDate = baseDate.toISOString().split('T')[0];

          setFormData(prev => ({ 
            ...prev, 
            amount: price,
            due_date: autoDueDate
          }));
        }
      }
    }, [formData.plan_id, applyDiscount, formData.payment_date]);

    // Handle invoice preset triggers (e.g. from Renewal button in member details)
    useEffect(() => {
      if (showInvoiceForm && invoiceFormPreset) {
        const chosenPlan = plans.find(p => p._id === invoiceFormPreset.plan_id) || plans[0];
        const baseDate = new Date();
        const paymentDateStr = baseDate.toISOString().split('T')[0];
        baseDate.setMonth(baseDate.getMonth() + (chosenPlan ? chosenPlan.durationMonths : 1));
        const autoDueDate = baseDate.toISOString().split('T')[0];

        setFormData({
          member_id: invoiceFormPreset.member_id || members[0]?._id || '',
          plan_id: invoiceFormPreset.plan_id || plans[0]?._id || '',
          amount: chosenPlan ? chosenPlan.price : '',
          due_amount: '',
          payment_date: paymentDateStr,
          due_date: autoDueDate,
          status: 'Paid'
        });
      } else if (showInvoiceForm) {
        const firstPlan = plans[0];
        const baseDate = new Date();
        const paymentDateStr = baseDate.toISOString().split('T')[0];
        baseDate.setMonth(baseDate.getMonth() + (firstPlan ? firstPlan.durationMonths : 1));
        const autoDueDate = baseDate.toISOString().split('T')[0];

        setFormData({
          member_id: members[0]?._id || '',
          plan_id: plans[0]?._id || '',
          amount: plans[0]?.price || '',
          due_amount: '',
          payment_date: paymentDateStr,
          due_date: autoDueDate,
          status: 'Paid'
        });
      }
    }, [showInvoiceForm, invoiceFormPreset]);

    const handleFormSubmit = async (e) => {
      e.preventDefault();
      try {
        await api.createInvoice(formData);
        showSuccess('New transaction invoice generated.');
        setShowInvoiceForm(false);
        setInvoiceFormPreset(null);
        refreshPayments();
      } catch (err) {
        showError(err.message);
      }
    };

    const handleMarkAsPaid = async (id) => {
      try {
        await api.updatePaymentStatus(id, 'Paid');
        showSuccess('Invoice status set to PAID.');
        refreshPayments();
      } catch (err) {
        showError(err.message);
      }
    };

    const handleDeleteInvoice = async (id) => {
      if (!window.confirm('Are you sure you want to delete this invoice?')) return;
      try {
        await api.deleteInvoice(id);
        showSuccess('Invoice deleted.');
        refreshPayments();
      } catch (err) {
        showError(err.message);
      }
    };

    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Billing & Payments Ledger</h2>
          <button onClick={() => {
            setApplyDiscount(false);
            setInvoiceFormPreset(null);
            setShowInvoiceForm(true);
          }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={16} /> Generate Invoice</button>
        </div>

        {/* Transactions Table */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Member</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Dues</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id}>
                  <td style={{ fontWeight: 600 }}>{p.invoice_number}</td>
                  <td>{p.member_name}</td>
                  <td>{p.plan_name}</td>
                  <td style={{ fontWeight: 700 }}>₹{p.amount}</td>
                  <td style={{ color: p.due_amount > 0 ? 'var(--status-expired)' : 'inherit' }}>₹{p.due_amount || 0}</td>
                  <td>{p.payment_date}</td>
                  <td>
                    <span className={`badge ${
                      p.status === 'Paid' ? 'badge-active' : p.status === 'Partially Paid' ? 'badge-pending' : 'badge-expired'
                    }`}>{p.status}</span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    {p.status !== 'Paid' && (
                      <button onClick={() => handleMarkAsPaid(p._id)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--status-active)' }}>Mark Paid</button>
                    )}
                    <button onClick={() => { setActiveReceipt(p); setShowReceipt(true); }} className="btn btn-secondary" style={{ padding: '0.3rem' }}><Printer size={14} /></button>
                    <button onClick={() => handleDeleteInvoice(p._id)} className="btn btn-secondary" style={{ padding: '0.3rem', color: 'var(--status-expired)' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PortalModal isOpen={showInvoiceForm}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="glass-card" 
            style={{ 
              width: '100%', maxWidth: '500px', 
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, 
              background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Generate Custom Invoice</h3>
              <button onClick={() => { setShowInvoiceForm(false); setInvoiceFormPreset(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select Member</label>
                  <select value={formData.member_id} onChange={(e) => setFormData({...formData, member_id: e.target.value})} required>
                    {members.map(m => (
                      <option key={m._id} value={m._id}>{m.name} ({m.memberId})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Select Plan</label>
                  <select value={formData.plan_id} onChange={(e) => setFormData({...formData, plan_id: e.target.value})} required>
                    {plans.map(p => (
                      <option key={p._id} value={p._id}>{p.name} - ₹{p.price}</option>
                    ))}
                  </select>
                </div>

                {/* Leader Discount Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,81,0,0.06)', padding: '0.8rem', borderRadius: '6px', border: '1px dashed var(--accent-orange)' }}>
                  <input type="checkbox" id="leaderDiscount" checked={applyDiscount} onChange={(e) => setApplyDiscount(e.target.checked)} style={{ cursor: 'pointer', width: 'auto' }} />
                  <label htmlFor="leaderDiscount" style={{ fontSize: '0.9rem', color: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}>Apply 20% Leader Discount</label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Amount Paid (INR)</label>
                  <input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required />
                </div>
                
                {/* Due amount field */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Outstanding Due Amount (Optional)</label>
                  <input type="number" value={formData.due_amount} onChange={(e) => setFormData({...formData, due_amount: e.target.value})} placeholder="Leave blank if fully paid" />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Payment Date</label>
                  <input type="date" value={formData.payment_date} onChange={(e) => setFormData({...formData, payment_date: e.target.value})} required style={{ height: '42px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Subscription Expiry / Due Date</label>
                  <input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})} required style={{ height: '42px' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partially Paid">Partially Paid</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Generate Invoice</button>
              </form>
            </div>
          </motion.div>
        </PortalModal>

        <PortalModal isOpen={showReceipt && activeReceipt} zIndex={250}>
          {activeReceipt && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="glass-card printable-invoice" style={{ width: '100%', maxWidth: '550px', background: '#fff', color: '#000', padding: '2.5rem', borderRadius: '12px', border: 'none', boxShadow: 'none' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <Dumbbell size={35} color="#ff5100" style={{ marginBottom: '0.5rem' }} />
                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>God Gifts Fitness Point</h3>
                <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0.2rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                  <MapPin size={12} /> Sinnar, Nashik (Nashik Vess, 1st Floor of Aai Nivas)
                </p>
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', marginTop: '0.5rem' }}>OFFICIAL PAYMENT RECEIPT</p>
              </div>

              <div style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', color: '#1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.3rem 0' }}><span><strong>Invoice Number:</strong></span> <span>{activeReceipt.invoice_number}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.3rem 0' }}><span><strong>Date:</strong></span> <span>{activeReceipt.payment_date}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.3rem 0' }}><span><strong>Member Name:</strong></span> <span>{activeReceipt.member_name}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.3rem 0' }}><span><strong>Mobile Number:</strong></span> <span>{activeReceipt.member_phone}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.3rem 0' }}><span><strong>Selected Plan:</strong></span> <span>{activeReceipt.plan_name}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.3rem 0' }}><span><strong>Subscription Valid Up to:</strong></span> <span>{activeReceipt.due_date}</span></div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>
                  <span>Amount Paid:</span>
                  <span>₹{activeReceipt.amount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: '#475569' }}>
                  <span>Outstanding Due Amount:</span>
                  <span style={{ color: activeReceipt.due_amount > 0 ? '#ef4444' : '#475569', fontWeight: 600 }}>₹{activeReceipt.due_amount || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#0f172a', marginTop: '0.4rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.4rem' }}>
                  <span>Payment Status:</span>
                  <span style={{ color: activeReceipt.status === 'Paid' ? '#10b981' : '#f59e0b', fontWeight: 700 }}>{activeReceipt.status.toUpperCase()}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginBottom: '1.5rem' }}>
                Thank you for training with us! God Gifts Fitness Point Sinnar.
              </div>

              <div style={{ display: 'flex', gap: '1rem' }} className="receipt-actions">
                <button onClick={() => window.print()} className="btn btn-primary" style={{ flex: 1 }}>Print Invoice</button>
                <button onClick={() => setShowReceipt(false)} className="btn btn-secondary" style={{ flex: 1, color: '#000' }}>Close Dialog</button>
              </div>
            </motion.div>
          )}
        </PortalModal>
      </div>
    );
  }

  // ----------------------------------------------------
  // 6. SLOT MANAGEMENT PANEL
  // ----------------------------------------------------
  function SlotManagementView() {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
      id: '', name: '', timeRange: '', trainerId: '', maxCapacity: 20
    });

    const handleFormSubmit = async (e) => {
      e.preventDefault();
      try {
        if (formData.id) {
          await api.updateSlot(formData.id, formData);
          showSuccess('Slot updated successfully.');
        } else {
          await api.createSlot(formData);
          showSuccess('Trainer slot created successfully.');
        }
        setShowForm(false);
        refreshSlots();
      } catch (err) {
        showError(err.message);
      }
    };

    const handleDeleteSlot = async (id) => {
      if (!window.confirm('Delete this scheduling slot?')) return;
      try {
        await api.deleteSlot(id);
        showSuccess('Slot deleted.');
        refreshSlots();
      } catch (err) {
        showError(err.message);
      }
    };

    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Trainer Slots Scheduler</h2>
          <button onClick={() => {
            setFormData({ id: '', name: '', timeRange: '', trainerId: '', maxCapacity: 20 });
            setShowForm(true);
          }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Plus size={16} /> Create Slot</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {slots.map(s => (
            <div key={s._id} className="glass-card glow-card-blue" style={{ background: 'rgba(255, 255, 255, 0.01)', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{s.name}</h3>
                  <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>{s.timeRange}</span>
                </div>
                <p style={{ margin: '0.4rem 0', fontSize: '0.9rem' }}><strong>Assigned Trainer:</strong> {s.trainerId?.name || 'Unassigned'}</p>
                <p style={{ margin: '0.4rem 0', fontSize: '0.9rem' }}><strong>Capacity:</strong> {s.enrolledMembers?.length || 0} / {s.maxCapacity} enrolled</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <button onClick={() => {
                  setFormData({ id: s._id, name: s.name, timeRange: s.timeRange, trainerId: s.trainerId?._id || '', maxCapacity: s.maxCapacity });
                  setShowForm(true);
                }} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }}>Edit Slot</button>
                <button onClick={() => handleDeleteSlot(s._id)} className="btn btn-secondary" style={{ padding: '0.5rem', color: 'var(--status-expired)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Slot Modal form */}
        <PortalModal isOpen={showForm}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }} 
            className="glass-card" 
            style={{ 
              width: '100%', maxWidth: '450px', 
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: 0, 
              background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>{formData.id ? 'Edit Trainer Slot' : 'Create Trainer Slot'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '2rem', flex: 1 }}>
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Slot Name</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required placeholder="Morning Yoga / Muscle Building" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Time Range</label>
                  <input type="text" value={formData.timeRange} onChange={(e) => setFormData({...formData, timeRange: e.target.value})} required placeholder="06:00 AM - 07:30 AM" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Assign Trainer (Optional)</label>
                  <select value={formData.trainerId} onChange={(e) => setFormData({...formData, trainerId: e.target.value})}>
                    <option value="">Unassigned</option>
                    {trainers.map(t => (
                      <option key={t._id} value={t._id}>{t.name} ({t.specialization})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Maximum Capacity</label>
                  <input type="number" value={formData.maxCapacity} onChange={(e) => setFormData({...formData, maxCapacity: e.target.value})} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Slot Details</button>
              </form>
            </div>
          </motion.div>
        </PortalModal>
      </div>
    );
  }

  // ----------------------------------------------------
  // TRAINEE DASHBOARD VIEW
  // ----------------------------------------------------
  function TraineeDashboardView() {
    const [selectedMember, setSelectedMember] = useState(null);
    const [workoutRoutine, setWorkoutRoutine] = useState([]);
    const [dietRoutine, setDietRoutine] = useState([]);
    const [reportNotes, setReportNotes] = useState('');
    const [reportRating, setReportRating] = useState(5);

    const [meal, setMeal] = useState('');
    const [items, setItems] = useState('');
    const [day, setDay] = useState('');
    const [exercises, setExercises] = useState('');

    const selectMemberForPlan = async (m) => {
      setSelectedMember(m);
      setReportNotes('');
      setReportRating(5);
      try {
        const res = await api.getWorkoutDiet(m._id);
        setWorkoutRoutine(res.workoutRoutine || []);
        setDietRoutine(res.dietRoutine || []);
      } catch (err) {
        showError(err.message || 'Failed to load details.');
      }
    };

    const handleSaveWorkoutDiet = async () => {
      if (!selectedMember) return;
      try {
        await api.saveWorkoutDiet(selectedMember._id, workoutRoutine, dietRoutine);
        showSuccess('Diet and workout routines applied.');
      } catch (err) {
        showError(err.message);
      }
    };

    const handleReportSubmit = async (e) => {
      e.preventDefault();
      if (!reportNotes) return;
      try {
        const res = await api.submitProgressReport(selectedMember._id, reportNotes, reportRating);
        showSuccess('Trainer progress report submitted.');
        
        // Refresh selected member details to show report in list
        const refreshed = await api.getMember(selectedMember._id);
        setSelectedMember(refreshed);
        setReportNotes('');
        setReportRating(5);
        
        // Refresh members list
        refreshMembers();
      } catch (err) {
        showError(err.message || 'Submission failed.');
      }
    };

    const addMeal = () => {
      if (!meal || !items) return;
      setDietRoutine([...dietRoutine, { meal, items }]);
      setMeal('');
      setItems('');
    };

    const removeMeal = (index) => {
      setDietRoutine(dietRoutine.filter((_, idx) => idx !== index));
    };

    const addWorkout = () => {
      if (!day || !exercises) return;
      setWorkoutRoutine([...workoutRoutine, { day, exercises }]);
      setDay('');
      setExercises('');
    };

    const removeWorkout = (index) => {
      setWorkoutRoutine(workoutRoutine.filter((_, idx) => idx !== index));
    };

    // Filter trainee's assigned slots
    const traineeSlots = currentUser.role === 'Admin' ? slots : slots.filter(s => s.trainerId?._id === currentUser._id || s.trainerId === currentUser._id);

    // Format weight progress chart data
    const progressData = selectedMember && (selectedMember.weightHistory || []).map(w => ({
      date: w.date.substring(5), // MM-DD
      weight: w.weight
    }));

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Assigned Slots & Client Roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Assigned Batches widget */}
          <div className="glass-card glow-card-blue">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontWeight: 800 }}>{currentUser.role === 'Admin' ? 'Active Gym Batches' : 'My Assigned Batches'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {traineeSlots.length === 0 ? (
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No slots available.</span>
              ) : (
                traineeSlots.map(s => (
                  <div key={s._id} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{s.name}</strong>
                      <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>{s.timeRange}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Enrolled members: {s.enrolledMembers?.length || 0} / {s.maxCapacity}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Client Roster list */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.2rem', fontWeight: 800 }}>{currentUser.role === 'Admin' ? 'Member Roster' : 'My Client Roster'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {members.length === 0 ? (
                <span style={{ color: '#94a3b8' }}>{currentUser.role === 'Admin' ? 'No members found.' : 'No members currently assigned to you.'}</span>
              ) : (
                members.map(m => (
                  <div key={m._id} onClick={() => selectMemberForPlan(m)} style={{
                    padding: '1rem', borderRadius: '8px', cursor: 'pointer',
                    background: selectedMember?._id === m._id ? 'rgba(0, 225, 255, 0.08)' : 'rgba(255,255,255,0.01)',
                    border: selectedMember?._id === m._id ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.04)',
                    transition: '0.2s'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1rem' }}>{m.name}</strong>
                      {m.medicalIssues && m.medicalIssues.toLowerCase() !== 'none' && (
                        <span style={{ background: 'rgba(255, 85, 0, 0.2)', color: 'var(--accent-orange)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>Medical Alert</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Goal: {m.reasonForJoining} | {m.gender} ({m.age} yrs)</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Biometrics, Weight Graph, and Progress Reports */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {selectedMember ? (
            <>
              {/* Member biometrics & medical history alerts */}
              <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-orange)' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.8rem' }}>Bio Profile & Contact</h3>
                {selectedMember.medicalIssues && selectedMember.medicalIssues.toLowerCase() !== 'none' && (
                  <div className="dev-banner" style={{ background: 'rgba(255, 42, 95, 0.12)', border: '1px dashed var(--status-expired)', color: 'var(--status-expired)', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 700 }}>
                    ⚠️ MEDICAL ALERT: {selectedMember.medicalIssues}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.9rem' }}>
                  <div><strong>Mobile:</strong> {selectedMember.phone}</div>
                  <div><strong>Email:</strong> {selectedMember.email || 'N/A'}</div>
                  <div><strong>Age / Gender:</strong> {selectedMember.age} yrs / {selectedMember.gender}</div>
                  <div><strong>Goal Focus:</strong> <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>{selectedMember.reasonForJoining}</span></div>
                  <div><strong>Weight:</strong> {selectedMember.weight || 'N/A'} kg</div>
                  <div><strong>Height:</strong> {selectedMember.height || 'N/A'} cm</div>
                </div>
              </div>

              {/* Client Weight Progress Graph */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>Weight History Trend</h3>
                {progressData && progressData.length > 0 ? (
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <LineChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                        <XAxis dataKey="date" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ background: '#0c0e18', border: '1px solid var(--glass-border)', color: '#fff' }} />
                        <Line type="monotone" dataKey="weight" stroke="var(--accent-blue)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No weight logs recorded.</span>
                )}
              </div>



              {/* Submit Progress Report Form */}
              <div className="glass-card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem' }}>Submit Coach Progress Report</h3>
                <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Coach Performance Notes</label>
                    <textarea value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} required rows={3} placeholder="Describe their progress, form correction, energy levels, etc." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Performance Rating (1-5 Stars)</label>
                    <select value={reportRating} onChange={(e) => setReportRating(parseInt(e.target.value))}>
                      <option value={5}>⭐⭐⭐⭐⭐ (Excellent)</option>
                      <option value={4}>⭐⭐⭐⭐ (Very Good)</option>
                      <option value={3}>⭐⭐⭐ (Satisfactory)</option>
                      <option value={2}>⭐⭐ (Needs Improvement)</option>
                      <option value={1}>⭐ (Poor)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary">Submit Report Sheet</button>
                </form>

                {/* Historical Progress Reports List */}
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '1.5rem', marginBottom: '0.8rem', color: 'var(--accent-blue)' }}>Previous Report Sheets</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {!selectedMember.progressReports || selectedMember.progressReports.length === 0 ? (
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>No progress reports logged yet.</span>
                  ) : (
                    selectedMember.progressReports.slice().reverse().map((report, idx) => (
                      <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ color: '#94a3b8' }}>{report.date}</span>
                          <span style={{ color: 'var(--status-pending)' }}>{'⭐'.repeat(report.performanceRating || 5)}</span>
                        </div>
                        <p style={{ margin: 0, color: '#f8fafc' }}>{report.notes}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#64748b' }}>
              <BookOpen size={48} style={{ marginBottom: '1rem' }} />
              <span>Select an assigned member from client roster to configure workouts & diets.</span>
            </div>
          )}
        </div>

        {/* Right Column: Workouts & Diets assignments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {selectedMember && (
            <div className="glass-card">
              <h2 style={{ fontSize: '1.3rem', marginBottom: '1rem', fontWeight: 800 }}>Modify Client Sheets: {selectedMember.name}</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}><strong>Goal Focus:</strong> {selectedMember.reasonForJoining}</p>

              {/* Diet Planner */}
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--accent-orange)', marginBottom: '0.8rem' }}>Diet Plan Routine</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {dietRoutine.map((d, index) => (
                    <div key={index} style={{ display: 'flex', justify: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                      <span><strong>{d.meal}:</strong> {d.items}</span>
                      <button onClick={() => removeMeal(index)} style={{ background: 'none', border: 'none', color: 'var(--status-expired)', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Meal (Breakfast)" value={meal} onChange={(e) => setMeal(e.target.value)} style={{ flex: 1, minWidth: '100px' }} />
                  <input type="text" placeholder="Items (Oats, Eggs)" value={items} onChange={(e) => setItems(e.target.value)} style={{ flex: 2, minWidth: '150px' }} />
                  <button onClick={addMeal} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}><Plus size={16} /></button>
                </div>
              </div>

              {/* Workout Planner */}
              <div style={{ background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--accent-blue)', marginBottom: '0.8rem' }}>Workout routines</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {workoutRoutine.map((w, index) => (
                    <div key={index} style={{ display: 'flex', justify: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                      <span><strong>{w.day}:</strong> {w.exercises}</span>
                      <button onClick={() => removeWorkout(index)} style={{ background: 'none', border: 'none', color: 'var(--status-expired)', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Day (Monday Push)" value={day} onChange={(e) => setDay(e.target.value)} style={{ flex: 1, minWidth: '100px' }} />
                  <input type="text" placeholder="Exercises (Bench 4x8)" value={exercises} onChange={(e) => setExercises(e.target.value)} style={{ flex: 2, minWidth: '150px' }} />
                  <button onClick={addWorkout} className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}><Plus size={16} /></button>
                </div>
              </div>

              <button onClick={handleSaveWorkoutDiet} className="btn btn-primary" style={{ width: '100%' }}>Apply routines to Member</button>
            </div>
          )}
        </div>

      </div>
    );
  }

  // ----------------------------------------------------
  // MEMBER DASHBOARD VIEW
  // ----------------------------------------------------
  function MemberDashboardView() {
    const handleEnrollInSlot = async (slotId) => {
      try {
        const res = await api.enrollInSlot(slotId);
        showSuccess(res.message);
        loadDashboardData();
      } catch (err) {
        showError(err.message);
      }
    };

    const handleUnenrollFromSlot = async (slotId) => {
      try {
        const res = await api.unenrollFromSlot(slotId);
        showSuccess(res.message);
        loadDashboardData();
      } catch (err) {
        showError(err.message);
      }
    };

    const matchedPlan = plans.find(p => p._id === currentUser.planId);

    // Format weight progress line chart data
    const progressData = (currentUser.weightHistory || []).map(w => ({
      date: w.date.substring(5), // MM-DD format
      weight: w.weight
    }));

    return (
      <div className="responsive-dashboard-grid">
        {/* Left Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Weight Tracker & Recharts Line Graph */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Weight Tracker & Progress History</h2>
              <form onSubmit={handleRecordWeight} style={{ display: 'flex', gap: '0.5rem', width: 'auto', flexWrap: 'wrap' }}>
                <input type="number" placeholder="Weight (kg)" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} required style={{ padding: '0.4rem 0.8rem', width: '120px' }} />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>Log Weight</button>
              </form>
            </div>
            
            {progressData.length > 0 ? (
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#0c0e18', border: '1px solid var(--glass-border)', color: '#fff' }} />
                    <Line type="monotone" dataKey="weight" stroke="var(--accent-blue)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>No weight measurements logged yet. Log your weight to see progress trends.</div>
            )}
          </div>

          {/* Diet Schedule */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-orange)', marginBottom: '1.2rem' }}>My Assigned Diet Schedule</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {memberDiet && memberDiet.dietRoutine?.length > 0 ? (
                memberDiet.dietRoutine.map((d, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <strong style={{ color: 'var(--accent-blue)', display: 'block', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{d.meal}</strong>
                    <span style={{ fontSize: '0.9rem' }}>{d.items}</span>
                  </div>
                ))
              ) : (
                <span style={{ color: '#94a3b8' }}>Diet plan not assigned yet. Contact your personal trainer.</span>
              )}
            </div>
          </div>

          {/* Workout Routine */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-blue)', marginBottom: '1.2rem' }}>My Workout Routine</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {memberDiet && memberDiet.workoutRoutine?.length > 0 ? (
                memberDiet.workoutRoutine.map((w, idx) => (
                  <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <strong style={{ color: 'var(--accent-orange)', display: 'block', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{w.day}</strong>
                    <span style={{ fontSize: '0.9rem' }}>{w.exercises}</span>
                  </div>
                ))
              ) : (
                <span style={{ color: '#94a3b8' }}>No workouts assigned yet.</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          


          {/* Trainer Slots Enrollment */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem' }}>Available Trainer Slots</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {slots.map(s => {
                const enrolled = s.enrolledMembers?.some(m => m._id === currentUser._id || m === currentUser._id);
                const slotsRemaining = s.maxCapacity - (s.enrolledMembers?.length || 0);
                return (
                  <div key={s._id} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.8rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{s.name}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{s.timeRange}</span>
                    </div>
                    <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: slotsRemaining <= 3 ? 'var(--status-expired)' : '#94a3b8', fontWeight: slotsRemaining <= 3 ? 600 : 400 }}>
                      {slotsRemaining <= 0 ? 'Full' : `${slotsRemaining} slots remaining`}
                    </p>
                    {enrolled ? (
                      <button onClick={() => handleUnenrollFromSlot(s._id)} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem', fontSize: '0.8rem', color: 'var(--status-expired)' }}>Unenroll</button>
                    ) : (
                      <button onClick={() => handleEnrollInSlot(s._id)} disabled={slotsRemaining <= 0} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem', fontSize: '0.8rem', fontWeight: 600 }}>Enroll in Batch</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // GENERAL SYSTEM REPORTING PANEL (ADMIN ONLY)
  // ----------------------------------------------------
  function ReportsView() {
    const todayStr = getTodayDate();
    const currentMonth = todayStr.substring(0, 7); // YYYY-MM
    const currentYear = todayStr.substring(0, 4); // YYYY

    // Helper to check if a date is within last N days
    const isWithinDays = (dateStr, days) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const today = new Date(todayStr);
      const diffTime = today - d;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= days;
    };

    if (!dashboardData) return <div>Loading reports data...</div>;

    const { metrics, planDistribution } = dashboardData;

    // Calculate revenue metrics from payments array (from parent state)
    const paidInvoices = payments.filter(p => p.status === 'Paid');
    
    const dailyRevenue = paidInvoices
      .filter(p => p.payment_date === todayStr)
      .reduce((sum, p) => sum + p.amount, 0);

    const weeklyRevenue = paidInvoices
      .filter(p => isWithinDays(p.payment_date, 7))
      .reduce((sum, p) => sum + p.amount, 0);

    const monthlyRevenueCalculated = paidInvoices
      .filter(p => p.payment_date && p.payment_date.startsWith(currentMonth))
      .reduce((sum, p) => sum + p.amount, 0);

    const annualRevenue = paidInvoices
      .filter(p => p.payment_date && p.payment_date.startsWith(currentYear))
      .reduce((sum, p) => sum + p.amount, 0);

    const totalOutstandingDues = payments
      .reduce((sum, p) => sum + (p.due_amount || 0), 0);

    const totalInvoicesCount = payments.length || 1;
    const paidInvoicesCount = payments.filter(p => p.status === 'Paid').length;
    const partiallyPaidInvoicesCount = payments.filter(p => p.status === 'Partially Paid').length;
    const unpaidInvoicesCount = payments.filter(p => p.status === 'Unpaid' || p.status === 'Pending').length;

    const paidPct = Math.round((paidInvoicesCount / totalInvoicesCount) * 100);
    const partialPct = Math.round((partiallyPaidInvoicesCount / totalInvoicesCount) * 100);
    const unpaidPct = Math.round((unpaidInvoicesCount / totalInvoicesCount) * 100);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Financial Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          
          <div className="glass-card glow-card-orange" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Daily Income (Today)</span>
              <Activity size={18} color="var(--accent-orange)" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{dailyRevenue}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Paid invoices today</div>
          </div>

          <div className="glass-card glow-card-orange" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Weekly Income</span>
              <TrendingUp size={18} color="var(--accent-orange)" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{weeklyRevenue}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Last 7 days revenue</div>
          </div>

          <div className="glass-card glow-card-orange" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Monthly Income</span>
              <CreditCard size={18} color="var(--accent-orange)" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{monthlyRevenueCalculated || metrics.monthlyRevenue}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Current calendar month</div>
          </div>

          <div className="glass-card glow-card-orange" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Annual Income</span>
              <FileText size={18} color="var(--accent-orange)" />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹{annualRevenue}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Current calendar year</div>
          </div>

        </div>

        {/* Outstanding Dues Alert Card */}
        {totalOutstandingDues > 0 && (
          <div className="glass-card" style={{ 
            display: 'flex', 
            justify: 'space-between', 
            alignItems: 'center', 
            background: 'rgba(239, 68, 68, 0.05)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '1.25rem',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <ShieldAlert size={24} color="var(--status-expired)" style={{ filter: 'drop-shadow(0 0 5px rgba(239,68,68,0.4))' }} />
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Outstanding Dues Alert</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Total pending and partially paid dues remaining to be collected.</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-expired)' }}>₹{totalOutstandingDues}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>across {partiallyPaidInvoicesCount + unpaidInvoicesCount} invoices</div>
            </div>
          </div>
        )}

        <div>
          
          {/* Plan Distribution Chart */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Membership Plan Demographics</h3>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={planDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: '#0c0e18', border: '1px solid var(--glass-border)', color: '#fff' }} />
                  <Bar dataKey="count" fill="var(--accent-blue)">
                    {planDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--accent-orange)' : 'var(--accent-blue)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Invoice status distribution */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Collection Efficiency & Invoices Overview</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>Fully Paid Invoices ({paidInvoicesCount} of {totalInvoicesCount})</span>
                <span style={{ color: 'var(--status-active)', fontWeight: 700 }}>{paidPct}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${paidPct}%`, height: '100%', background: 'var(--status-active)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>Partially Paid Invoices ({partiallyPaidInvoicesCount} of {totalInvoicesCount})</span>
                <span style={{ color: 'var(--status-pending)', fontWeight: 700 }}>{partialPct}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${partialPct}%`, height: '100%', background: 'var(--status-pending)' }}></div>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span>Unpaid / Pending Invoices ({unpaidInvoicesCount} of {totalInvoicesCount})</span>
                <span style={{ color: 'var(--status-expired)', fontWeight: 700 }}>{unpaidPct}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${unpaidPct}%`, height: '100%', background: 'var(--status-expired)' }}></div>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER APP ROUTER LAYOUT
  // ----------------------------------------------------
  return (
    <div className="app-container">
      
      {/* Mobile Header Bar */}
      <div className="mobile-header-bar">
        <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="God Gifts Logo" style={{ height: '32px', width: 'auto', filter: 'drop-shadow(0 0 5px rgba(255,170,0,0.15))' }} />
        </div>
        <button onClick={toggleNotifications} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Bell size={20} />
            {notifications.length > 0 && !notificationsRead && (
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '6px', height: '6px', background: 'var(--status-expired)', borderRadius: '50%' }} />
            )}
          </div>
        </button>
      </div>

      {/* Sidebar Overlay (collapsible background) */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar navigation */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2.5rem' }}>
            <img src="/logo.png" alt="God Gifts Logo" style={{ width: '160px', height: 'auto', filter: 'drop-shadow(0 0 5px rgba(255,170,0,0.15))' }} />
          </div>

          {/* Navigation Links */}
            <button onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: activeTab === 'dashboard' ? 'rgba(255,81,0,0.12)' : 'none', color: activeTab === 'dashboard' ? 'var(--accent-orange)' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><Activity size={18} /> Dashboard</button>
            <button onClick={() => { setActiveTab('members'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: activeTab === 'members' ? 'rgba(255,81,0,0.12)' : 'none', color: activeTab === 'members' ? 'var(--accent-orange)' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><Users size={18} /> Members</button>
            <button onClick={() => { setActiveTab('trainees'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: activeTab === 'trainees' ? 'rgba(255,81,0,0.12)' : 'none', color: activeTab === 'trainees' ? 'var(--accent-orange)' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><Dumbbell size={18} /> Trainees</button>
            <button onClick={() => { setActiveTab('plans'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: activeTab === 'plans' ? 'rgba(255,81,0,0.12)' : 'none', color: activeTab === 'plans' ? 'var(--accent-orange)' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><Settings size={18} /> Plans & Pricing</button>
            <button onClick={() => { setActiveTab('payments'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: activeTab === 'payments' ? 'rgba(255,81,0,0.12)' : 'none', color: activeTab === 'payments' ? 'var(--accent-orange)' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><CreditCard size={18} /> Invoices Desk</button>
            <button onClick={() => { setActiveTab('slots'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: activeTab === 'slots' ? 'rgba(255,81,0,0.12)' : 'none', color: activeTab === 'slots' ? 'var(--accent-orange)' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><Calendar size={18} /> Slots Scheduling</button>
            <button onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: activeTab === 'reports' ? 'rgba(255,81,0,0.12)' : 'none', color: activeTab === 'reports' ? 'var(--accent-orange)' : '#94a3b8', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><FileText size={18} /> Reports</button>
        </div>

        {/* Profile/Logout section */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '50%' }}><UserIcon size={18} /></div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, width: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{currentUser.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.8rem 1rem', width: '100%', border: 'none', background: 'none', color: 'var(--status-expired)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', textAlign: 'left' }}><LogOut size={18} /> Logout</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        
        {/* Header Navigation Controls (Notifications icon) - Hidden on mobile, shown on desktop */}
        <div className="desktop-notification-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
          <button onClick={toggleNotifications} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', padding: '0.6rem', borderRadius: '50%', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Bell size={20} />
              {notifications.length > 0 && !notificationsRead && (
                <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', background: 'var(--status-expired)', borderRadius: '50%' }} />
              )}
            </div>
          </button>

          {/* Notifications Dropdown Panel */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="glass-card" 
                style={{ position: 'absolute', top: '45px', right: 0, width: '320px', zIndex: 210, background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem', marginBottom: '0.8rem' }}>
                  <strong style={{ fontSize: '0.95rem' }}>System Alerts ({notifications.length})</strong>
                  <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={16} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <span style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No active alerts. All systems healthy.</span>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} style={{ display: 'flex', gap: '0.4rem', background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: '4px', borderLeft: `3px solid ${n.type === 'error' ? 'var(--status-expired)' : n.type === 'warning' ? 'var(--status-pending)' : 'var(--accent-blue)'}`, fontSize: '0.8rem' }}>
                        <Info size={14} style={{ flexShrink: 0, color: n.type === 'error' ? 'var(--status-expired)' : n.type === 'warning' ? 'var(--status-pending)' : 'var(--accent-blue)' }} />
                        <span>{n.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Global Notifications Alerts */}
        <AnimatePresence>
          {globalError && (
            <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="alert alert-error" style={{ background: 'var(--status-expired)', color: '#fff', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 15px var(--status-expired-glow)' }}>
              <AlertTriangle size={18} />
              {globalError}
            </motion.div>
          )}
          {globalSuccess && (
            <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="alert alert-success" style={{ background: 'var(--status-active)', color: '#000', padding: '1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 15px var(--status-active-glow)', fontWeight: 600 }}>
              <CheckCircle size={18} />
              {globalSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab routing */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === 'dashboard' && <AdminDashboardView />}
            {activeTab === 'members' && <MemberDirectoryView />}
            {activeTab === 'trainees' && <TraineeManagementView />}
            {activeTab === 'plans' && <PlansManagementView />}
            {activeTab === 'payments' && <PaymentsManagementView />}
            {activeTab === 'slots' && <SlotManagementView />}
            {activeTab === 'reports' && <ReportsView />}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
