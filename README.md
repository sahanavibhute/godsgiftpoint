# God's Gift Fitness Point - Gym Management System

A premium, modern, and highly interactive Full-Stack Gym Management System built for **God's Gift Fitness Point**. It features a dark-themed user interface with glassmorphism, responsive grids, custom SVG metrics charts, billing invoices, receipt printers, and trainer diet/workout routine editors.

## 🚀 Technology Stack
* **Frontend**: Vite + React + Vanilla CSS (CSS variables, glassmorphic effects, responsive layout)
* **Backend**: Node.js + Express (REST API endpoints)
* **Database**: SQLite3 (relational local file-based database `gym.db` with Promise helpers)
* **Icons**: Lucide React

---

## 🛠️ How to Run Locally

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18 or higher recommended).

### Step 1: Initialize and Start the Backend
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Initialize the SQLite database and seed the mock data:
   ```bash
   npm run seed
   ```
3. Start the Express API server:
   ```bash
   npm start
   ```
   *The backend server will run on [http://localhost:5000](http://localhost:5000).*

### Step 2: Start the Frontend App
1. Open a **second terminal** and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   *The frontend application will start on [http://localhost:5173](http://localhost:5173).*
3. Open your browser and navigate to the dev server link!

---

## ✨ Features Included

### 📊 1. Main Dashboard
* **Real-time Metrics**: Total members count, active client load, today's attendance check-ins, monthly income, and pending fees.
* **Quick Check-In Widget**: Quickly search for active members by name or ID to mark them checked in or checked out.
* **Interactive SVG Charts**: Dynamic representation of members across different subscription plans.
* **Live Activity Logs**: View today's checked-in members list and recent invoice statuses.

### 👥 2. Members Directory & Medical History
* **Detailed Directory**: Search and filter members by name, phone, ID, or status (Active, Pending Payment, Expired).
* **Medical History Flag**: Added a dedicated medical history input field. Any injuries, asthma, ACL recovery flags, or restrictions are highlighted in a prominent **orange alert banner** when the trainer opens a member profile.
* **Member Profiles**: Detailed view containing active diet plans, payment transaction logs, contact details, and attendance sheets.

### 💳 3. Billing, Payments & Receipt Printing
* **Invoice Log**: Transactions table displaying unpaid, paid, and overdue invoice sheets.
* **Billing Generator**: Generate new custom invoices with custom prices, issue dates, and auto-computed expiry dates.
* **HTML Receipt Printer**: Preview and print clean, monochrome receipt bills for customers.

### 🏋️‍♂️ 4. Trainers Management
* **Trainer Profiles**: Track specializations (weight loss, powerlifting, HIIT), active client load counts, contact details, and shifts (Morning / Evening).

### 📋 5. Workout & Diet Planner
* **Routine Builder**: Create custom workout plans and diet routines per client.
* **Goal Templates**: Instant buttons to load standard templates for "Weight Loss & Conditioning" or "Muscle Hypertrophy" to speed up trainer assignments.

### 💾 6. Database Backups (JSON Portability)
* **Export JSON**: Download the entire SQLite database contents in a single `.json` file for backup.
* **Restore JSON**: Upload a JSON backup file to instantly restore all members, payments, and logs.
