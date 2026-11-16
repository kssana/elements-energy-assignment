# Elements Energy – Technical Assignment
## Task 2: Smart Meter Energy Analytics Dashboard

An interactive, production-ready web dashboard built to analyze smart electricity meter telemetry, visualize consumer-wise consumption in Indian Standard Time (IST), and automatically detect real-world data-quality anomalies.

---

## 🚀 How to Run Locally on Any Device

This repository is fully cross-platform and verified on **macOS**, **Linux**, and **Windows**.

### Prerequisites
* **Node.js** (v18.0.0 or higher) — [Download Node.js](https://nodejs.org/)
* **npm** (comes bundled with Node.js)
* **git** — [Download Git](https://git-scm.com/)

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
   Open your browser and navigate to:
   👉 **`http://localhost:5173/`**

*(Note: You can also navigate directly into the `dashboard` directory and run `npm install && npm run dev` if you prefer.)*

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

## 🎯 Evaluator Walkthrough: What to Test in the Dashboard

When you open the web application, here are 4 specific scenarios to verify that all assignment criteria are met:

### 1. Verify Meter Rollback / Replacement Detection
* In the **Country** dropdown, select **Brazil**.
* In the **Consumer Meter** dropdown, select **`BR-01-002`**.
* **Observe Chart 1 (Line Chart)**: You will see a dramatic drop on October 3rd where the meter counter drops from `16,663.37 kWh` to `10,670.77 kWh` (a $-5,992.6\text{ kWh}$ drop).
* **Observe the Audit Log below**: The system automatically flags this with a red **CRITICAL** badge: *"Meter counter plummeted by 5992.6 kWh for BR-01-002! Likely physical meter swap or memory rollback."*

### 2. Verify Conflicting Timestamp Detection
* In the **Country** dropdown, select **India**.
* In the **Consumer Meter** dropdown, select **`IN-04-002`**.
* **Observe the Audit Log**: On `02 Oct 2026, 04:30 PM IST`, the system flags a **CRITICAL** conflicting duplicate timestamp where the meter sent two differing values (`23892.619 kWh` vs `23889.869 kWh`) at the exact same second.

### 3. Verify Consumption Spike Detection
* In the **Country** dropdown, select **South Africa**.
* In the **Consumer Meter** dropdown, select **`SO-05-003`**.
* **Observe Chart 2 (Bar Chart)**: Notice the red bar on October 4th reaching **16.43 kWh**, surpassing the spike threshold line ($15\text{ kWh}$).

### 4. Verify CSV Export
* Click the green **"Export Hourly CSV"** button in the top navbar.
* It instantly generates and downloads an aggregated CSV file containing all filtered hourly windows, min/max values, calculated consumption, and integrity status.

---

## 📐 Detailed Logic & Methodologies

### 1. Hourly Consumption Aggregation (Section C)
* **Aggregation Window**: Raw telemetry readings are partitioned into 1-hour UTC intervals:
  $$\text{Interval} = [H:00:00.000\text{ UTC},\, H:59:59.999\text{ UTC}]$$
* **Consumption Calculation Formula**:
  $$\text{Hourly Consumption} = \max(\text{meter\_reading}) - \min(\text{meter\_reading})$$
* **Timezone Handling**:
  * Raw readings are stored in UTC (`timestamp_utc`).
  * As required by the assignment, timestamps are explicitly converted to **Indian Standard Time (IST, UTC+05:30)** by applying a $+5\text{ hours } 30\text{ minutes}$ offset ($+19,800,000\text{ ms}$).
  * All chart axes, hover tooltips, date pickers, and drill-down tables operate in IST.
* **Distinguishing Zero Consumption vs. Incomplete/Missing Data**:
  * **Genuine Zero Consumption** (Slate indicator): $\ge 2$ readings were recorded in the hour and $\max(\text{reading}) - \min(\text{reading}) == 0$. The meter was active and verified that zero electricity was consumed.
  * **Incomplete Interval** (Amber indicator): Only $1$ reading arrived during the hour. A delta cannot be mathematically computed over a single point, so it is explicitly flagged as incomplete rather than falsely reported as zero.
  * **Normal Consumption** (Emerald indicator): $\ge 2$ readings with normal positive consumption.

---

### 2. Data Quality & Anomaly Detection (Section B)

The dashboard includes a dedicated anomaly detection engine auditing every reading:

| Anomaly Category | Severity | Detection Rule | Real-World Context & Handling |
| :--- | :--- | :--- | :--- |
| **Exact Duplicate Rows** | Warning | Same consumer, timestamp, and reading | Caused by network re-transmission / idempotent retries. Flagged in audit log. |
| **Conflicting Timestamps** | Critical | Same consumer and timestamp, but different reading values | Telemetry collision / corrupted packet payload (e.g. `IN-04-002` discrepancy of $2.75\text{ kWh}$). |
| **Out-of-Order Records** | Info | Timestamp is earlier than the consumer's previous row in the file | Asynchronous packet transmission. Ingest engine sorts chronologically per consumer before processing. |
| **Catastrophic Meter Drop** | Critical | Consecutive reading drops by $>10.0\text{ kWh}$ | Physical meter swap or register rollover (e.g. `BR-01-002` dropping by $-5,992.6\text{ kWh}$). |
| **Sensor Jitter / Micro-Drop** | Warning | Consecutive reading drops by $\le 10.0\text{ kWh}$ | Floating point or ADC quantization noise (70 micro-drops between $-0.001$ and $-0.035\text{ kWh}$). |
| **Consumption Spike** | Warning | Hourly consumption $> 15.0\text{ kWh}$ ($> Q3 + 1.5 \times \text{IQR}$) | Unusual power surge; highlighted in rose/red on the bar chart. |

---

## 📊 Summary of Ground Truth in the Provided Dataset

* **File**: `smart_meter_data.csv` (746 KB)
* **Total Records**: 14,995 rows
* **Geographic Scope**: 5 countries (Brazil, China, India, Russia, South Africa)
* **Consumers**: Exactly 15 consumers (3 per country, ~1,000 readings each)
* **Time Span**: 5 continuous days (120 hours = 1,800 hourly blocks)
  * UTC: `2026-10-01 00:00:06` to `2026-10-05 23:59:51`
  * IST: `2026-10-01 05:30:06` to `2026-10-06 05:29:51`
* **Sampling Frequency**: Average reading interval of ~7.2 minutes (~8 to 9 readings/hour).
* **Average Hourly Consumption**: ~9.58 kWh per consumer-hour.

---

## 🛠️ Codebase Structure

To make the codebase accessible, transparent, and easy to review, the application is organized cleanly with zero bloated abstractions:

```
Elements_Energy_Assignment/
├── package.json                   # Root convenience scripts (npm run dev from root)
├── README.md                      # Complete evaluation guide & technical documentation
├── smart_meter_data.csv           # Telemetry dataset (14,995 rows)
├── explore_data.py                # Standalone data profiling script
└── dashboard/                     # React + TypeScript frontend application
    ├── package.json               # Frontend dependencies (React, Recharts, Lucide, PapaParse)
    ├── vite.config.ts             # Vite configuration with Tailwind CSS plugin
    ├── public/
    │   └── smart_meter_data.csv   # Client-side accessible CSV asset
    └── src/
        ├── App.tsx                # Complete, self-contained dashboard application
        ├── index.css              # Global styles and Tailwind imports
        └── main.tsx               # Application bootstrap
```

---

## 🔧 Troubleshooting

* **Port 5173 is already in use:**
  If another process is using port 5173, Vite will automatically switch to another port (e.g. `5174`), or you can specify a port:
  ```bash
  cd dashboard
  npx vite --port 3000
  ```
* **Node.js version:**
  This project uses standard ES modules supported on Node.js 18, 20, 22, and 24.
