# Free Hosting Guide: God's Gift Fitness Point

This guide describes how to deploy and host the entire application for free using **MongoDB Atlas** (for database hosting), **Render** (for Express API backend hosting), and **Vercel** (for React static frontend hosting).

---

## Step 1: Set Up MongoDB Atlas (Free Database)
Your local MongoDB instance (`mongodb://localhost`) won't work in production. You need a free cloud database.

1. Go to [MongoDB Atlas](https://www.mongodb.com/products/platform/atlas-database) and sign up for a free account.
2. Create a new cluster and select the **M0 Shared Free Tier**.
3. Under **Security Quickstart**:
   - Create a database user (e.g. username `gymadmin`, generate a strong password and save it).
   - Under **IP Access List**, add `0.0.0.0/0` (allows connection access from Render's cloud servers).
4. Go to the Database Deployment dashboard, click **Connect** -> **Drivers** -> copy the **Connection String**.
   - Example connection string: `mongodb+srv://gymadmin:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
   - Be sure to replace `<password>` with your actual database user password.

---

## Step 2: Deploy the Backend API Server to Render (Free Web Service)
Render is a cloud hosting platform with a generous free tier for Node.js backend services.

1. Sign up/log in to [Render](https://render.com/).
2. Push your project codebase to a GitHub repository (private or public).
3. In the Render Dashboard, click **New +** and select **Web Service**.
4. Connect your GitHub repository.
5. Configure the service settings:
   - **Name**: `gods-gift-gym-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Select **Free**.
6. Click **Advanced** to add environment variables:
   - `MONGO_URI`: *Your MongoDB Atlas Connection String from Step 1*
   - `JWT_SECRET`: *A strong random string (e.g., `gymSuperSecretKey9988`)*
7. Click **Create Web Service**. Once deployed, Render will provide a public URL for your backend API (e.g., `https://gods-gift-gym-backend.onrender.com`). Save this link!

---

## Step 3: Deploy the Frontend Website to Vercel (Free Static Site)
Vercel offers fast static hosting that connects perfectly with Vite.

1. Sign up/log in to [Vercel](https://vercel.com/).
2. Click **Add New** -> **Project**.
3. Select the same GitHub repository.
4. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add the following variable so the React client calls your hosted Render API:
   - Key: `VITE_API_URL`
   - Value: *Your Render Backend URL from Step 2 (e.g., `https://gods-gift-gym-backend.onrender.com`)*
6. Click **Deploy**.
7. Vercel will build the frontend bundle and provide a free public URL (e.g., `https://gods-gift-gym.vercel.app`) to access the running system!

---

## Step 4: Seed the Production Database (Optional)
To populate your production database with the default plans, Admin account (`7887358585` / `1234`), and mock members:

1. In your local terminal, temporarily change the `MONGO_URI` variable in `backend/.env` to point to your new cloud MongoDB Atlas connection string.
2. In the `backend` folder, run:
   ```bash
   npm run seed
   ```
3. Revert your local `.env` connection string back to `mongodb://localhost:27017/gods-gift-fitness` for local testing.
