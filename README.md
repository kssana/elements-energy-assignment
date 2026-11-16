# Smart Meter Energy Analytics Dashboard

An interactive dashboard built to analyze smart electricity meter telemetry, visualize consumer-wise consumption and detect real-world data-quality anomalies.

---

## How to Run Locally 

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm** (comes bundled with Node.js)
* **git**

---

### Step-by-Step Instructions

1. **Clone this repository to your computer:**
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd Elements_Energy_Assignment
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *(This automatically installs all dependencies for the dashboard via our root script.)*

3. **Start the local development server:**
   ```bash
   npm run dev
   ```

4. **View the dashboard:**
    **`http://localhost:5173/`**

---

## ☁️ Cloud Deployment (Vercel / Netlify / Render)

This repository is pre-configured with a root `vercel.json` and static asset bundle:

1. Import this GitHub repository into **[Vercel](https://vercel.com/)**, **[Netlify](https://www.netlify.com/)**, or **Cloudflare Pages**.
2. No manual build configuration is required (the included `vercel.json` automatically maps the build command `npm --prefix dashboard run build` and output directory `dashboard/dist`).
3. Click **Deploy** to get an instant live production URL.

---

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open your web browser and go to:
   👉 **`http://localhost:5173/`**

---


