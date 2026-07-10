const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getHeaders() {
  const user = JSON.parse(localStorage.getItem('gymUser') || '{}');
  const headers = { 'Content-Type': 'application/json' };
  if (user && user.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }
  return headers;
}

async function handleResponse(response) {
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('gymUser');
      window.dispatchEvent(new Event('auth-session-expired'));
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Auth
  login: (phone, password, role) =>
    fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password, role }),
    }).then(handleResponse),

  registerMember: (memberData) =>
    fetch(`${API_BASE}/auth/register-member`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData),
    }).then(handleResponse),

  sendMsg91Otp: (phone) =>
    fetch(`${API_BASE}/auth/send-msg91-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).then(handleResponse),

  verifyMsg91Otp: (phone, code) =>
    fetch(`${API_BASE}/auth/verify-msg91-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    }).then(handleResponse),

  resendMsg91Otp: (phone) =>
    fetch(`${API_BASE}/auth/resend-msg91-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).then(handleResponse),

  verifyRegistrationOtp: (phone, code) =>
    fetch(`${API_BASE}/auth/verify-registration-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    }).then(handleResponse),

  sendForgotPasswordOtp: (identifier, role) => {
    const body = role === 'Trainee' ? { email: identifier, role } : { phone: identifier, role };
    return fetch(`${API_BASE}/auth/forgot-password-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handleResponse);
  },

  resetPassword: (identifier, role, code, newPassword) => {
    const body = role === 'Trainee' 
      ? { email: identifier, role, code, newPassword } 
      : { phone: identifier, role, code, newPassword };
    return fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handleResponse);
  },

  // Dashboard Metrics (Admin only)
  getDashboard: () =>
    fetch(`${API_BASE}/admin/dashboard`, {
      headers: getHeaders(),
    }).then(handleResponse),

  // Members
  getMembers: () =>
    fetch(`${API_BASE}/members`, {
      headers: getHeaders(),
    }).then(handleResponse),

  getMember: (id) =>
    fetch(`${API_BASE}/members/${id}`, {
      headers: getHeaders(),
    }).then(handleResponse),

  createMember: (member) =>
    fetch(`${API_BASE}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(member),
    }).then(handleResponse),

  updateMember: (id, member) =>
    fetch(`${API_BASE}/members/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(member),
    }).then(handleResponse),

  deleteMember: (id) =>
    fetch(`${API_BASE}/members/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  logMemberWeight: (id, weight) =>
    fetch(`${API_BASE}/members/${id}/weight`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ weight }),
    }).then(handleResponse),


  // Trainers (Admin)
  getTrainers: () =>
    fetch(`${API_BASE}/trainers`, {
      headers: getHeaders(),
    }).then(handleResponse),

  createTrainer: (trainer) =>
    fetch(`${API_BASE}/trainers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(trainer),
    }).then(handleResponse),

  updateTrainer: (id, trainer) =>
    fetch(`${API_BASE}/trainers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(trainer),
    }).then(handleResponse),

  deleteTrainer: (id) =>
    fetch(`${API_BASE}/trainers/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  // Plans
  getPlans: () => fetch(`${API_BASE}/plans`).then(handleResponse), // Public reads

  createPlan: (plan) =>
    fetch(`${API_BASE}/plans`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(plan),
    }).then(handleResponse),

  updatePlan: (id, plan) =>
    fetch(`${API_BASE}/plans/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(plan),
    }).then(handleResponse),

  deletePlan: (id) =>
    fetch(`${API_BASE}/plans/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  // Payments / Invoices (Admin)
  getPayments: () =>
    fetch(`${API_BASE}/payments`, {
      headers: getHeaders(),
    }).then(handleResponse),

  getMemberPayments: (memberId) =>
    fetch(`${API_BASE}/payments/member/${memberId}`, {
      headers: getHeaders(),
    }).then(handleResponse),

  createInvoice: (payment) =>
    fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payment),
    }).then(handleResponse),

  updatePaymentStatus: (id, status) =>
    fetch(`${API_BASE}/payments/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    }).then(handleResponse),

  deleteInvoice: (id) =>
    fetch(`${API_BASE}/payments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  // Workout & Diet
  getWorkoutDiet: (memberId) =>
    fetch(`${API_BASE}/workout-diet/${memberId}`, {
      headers: getHeaders(),
    }).then(handleResponse),

  saveWorkoutDiet: (memberId, workoutRoutine, dietRoutine) =>
    fetch(`${API_BASE}/workout-diet/${memberId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        workout_routine: workoutRoutine,
        diet_routine: dietRoutine,
      }),
    }).then(handleResponse),

  // Slots
  getSlots: () =>
    fetch(`${API_BASE}/slots`, {
      headers: getHeaders(),
    }).then(handleResponse),

  createSlot: (slotData) =>
    fetch(`${API_BASE}/slots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(slotData),
    }).then(handleResponse),

  updateSlot: (id, slotData) =>
    fetch(`${API_BASE}/slots/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(slotData),
    }).then(handleResponse),

  deleteSlot: (id) =>
    fetch(`${API_BASE}/slots/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then(handleResponse),

  enrollInSlot: (id) =>
    fetch(`${API_BASE}/slots/${id}/enroll`, {
      method: 'POST',
      headers: getHeaders(),
    }).then(handleResponse),

  unenrollFromSlot: (id) =>
    fetch(`${API_BASE}/slots/${id}/unenroll`, {
      method: 'POST',
      headers: getHeaders(),
    }).then(handleResponse),

  // Backup & Settings
  exportBackup: () =>
    fetch(`${API_BASE}/backup/export`, {
      headers: getHeaders(),
    }).then(handleResponse),

  // Progress Reports
  submitProgressReport: (id, notes, performanceRating) =>
    fetch(`${API_BASE}/members/${id}/progress-report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ notes, performanceRating }),
    }).then(handleResponse),
};
