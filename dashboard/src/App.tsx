import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Download,
  Clock,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine
} from 'recharts';

// ============================================================================
// PART 1: DATA STRUCTURES (TYPES)
// ============================================================================

// Represents a single row from smart_meter_data.csv
export interface MeterReading {
  consumer_number: string;
  timestamp_utc: string; // ISO string e.g. "2026-10-01T14:20:00Z"
  timestamp_ist: string; // Formatted IST string e.g. "01 Oct 2026, 07:50 PM"
  meter_reading: number; // Cumulative kWh counter
  country: string;
  rowIndex: number;      // Original line number in CSV
}

// Represents a 1-hour time window for consumption
export interface HourlyWindow {
  hourId: string;        // UTC hour identifier: "2026-10-01T14:00:00Z"
  istLabel: string;      // Human-readable IST hour label: "01 Oct 07:30 PM"
  istDate: string;       // Date in IST: "2026-10-01"
  readingCount: number;  // How many readings arrived in this hour
  minReading: number;    // Lowest reading in this hour
  maxReading: number;    // Highest reading in this hour
  consumption: number;   // Calculated as (maxReading - minReading)
  status: 'normal' | 'zero' | 'incomplete' | 'spike';
  statusReason: string;  // Plain English explanation of status
}

// Represents an anomaly or data-quality issue
export interface AnomalyAlert {
  id: string;
  type: 'duplicate' | 'out_of_order' | 'meter_drop' | 'consumption_spike' | 'incomplete_window';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  timestamp: string;     // IST formatted timestamp
  description: string;   // Plain English reason why it was flagged
  details: string;       // Additional technical detail (e.g. drop value)
}

// ============================================================================
// PART 2: TIMEZONE HELPERS (UTC to Indian Standard Time IST, UTC+05:30)
// ============================================================================
function getISTDate(utcString: string): Date {
  const utcMs = new Date(utcString).getTime();
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5 hours 30 mins
  return new Date(utcMs + istOffsetMs);
}

function formatIST(utcString: string): string {
  const d = getISTDate(utcString);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const hours24 = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${day} ${month} ${hours12}:${minutes} ${ampm} IST`;
}

function formatISTHourOnly(utcHourString: string): string {
  const d = getISTDate(utcHourString);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const hours24 = d.getUTCHours();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${day} ${month} ${hours12} ${ampm}`;
}

function getISTDateString(utcString: string): string {
  const d = getISTDate(utcString);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// PART 3: MAIN REACT APPLICATION
// ============================================================================
export default function App() {
  const [readings, setReadings] = useState<MeterReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedConsumer, setSelectedConsumer] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [anomalyFilter, setAnomalyFilter] = useState<string>('All');
  const [tableSearch, setTableSearch] = useState<string>('');

  // 1. DATA LOADING: Read CSV file from public/smart_meter_data.csv
  useEffect(() => {
    setIsLoading(true);
    fetch('/smart_meter_data.csv')
      .then((res) => {
        if (!res.ok) throw new Error('Could not find smart_meter_data.csv in public folder.');
        return res.text();
      })
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsed: MeterReading[] = [];
            (results.data as any[]).forEach((row, idx) => {
              if (row.consumer_number && row.timestamp_utc && row.meter_reading) {
                parsed.push({
                  consumer_number: String(row.consumer_number).trim(),
                  timestamp_utc: String(row.timestamp_utc).trim(),
                  timestamp_ist: formatIST(String(row.timestamp_utc).trim()),
                  meter_reading: parseFloat(row.meter_reading),
                  country: String(row.country || 'Unknown').trim(),
                  rowIndex: idx + 2
                });
              }
            });

            // Set default date range from dataset
            if (parsed.length > 0) {
              const allDates = parsed.map((r) => getISTDateString(r.timestamp_utc)).sort();
              setStartDate(allDates[0]);
              setEndDate(allDates[allDates.length - 1]);
            }

            setReadings(parsed);
            setIsLoading(false);
          },
          error: (err: any) => {
            setErrorMessage('CSV Parsing Error: ' + err.message);
            setIsLoading(false);
          }
        });
      })
      .catch((err) => {
        setErrorMessage(err.message);
        setIsLoading(false);
      });
  }, []);

  // 2. DROPDOWN LISTS: Unique countries & consumers
  const countries = useMemo(() => {
    const set = new Set<string>();
    readings.forEach((r) => set.add(r.country));
    return ['All', ...Array.from(set).sort()];
  }, [readings]);

  const consumersForCountry = useMemo(() => {
    const set = new Set<string>();
    readings.forEach((r) => {
      if (selectedCountry === 'All' || r.country === selectedCountry) {
        set.add(r.consumer_number);
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [readings, selectedCountry]);

  useEffect(() => {
    if (selectedConsumer !== 'All' && !consumersForCountry.includes(selectedConsumer)) {
      setSelectedConsumer('All');
    }
  }, [selectedCountry, consumersForCountry, selectedConsumer]);

  // 3. ANOMALY DETECTION: Find duplicates, out-of-order rows, and meter drops
  const allAnomalies = useMemo(() => {
    const alerts: AnomalyAlert[] = [];

    // Check for Duplicates
    const seenExact = new Set<string>();
    const seenTimestamps = new Map<string, MeterReading>();

    readings.forEach((r) => {
      const exactKey = `${r.consumer_number}|${r.timestamp_utc}|${r.meter_reading}`;
      if (seenExact.has(exactKey)) {
        alerts.push({
          id: `dup-${r.rowIndex}`,
          type: 'duplicate',
          severity: 'warning',
          title: 'Exact Duplicate Reading',
          timestamp: r.timestamp_ist,
          description: `Row ${r.rowIndex} for consumer ${r.consumer_number} is an exact re-transmission duplicate.`,
          details: `Reading: ${r.meter_reading} kWh`
        });
      }
      seenExact.add(exactKey);

      const tsKey = `${r.consumer_number}|${r.timestamp_utc}`;
      if (seenTimestamps.has(tsKey)) {
        const prev = seenTimestamps.get(tsKey)!;
        if (prev.meter_reading !== r.meter_reading) {
          alerts.push({
            id: `ts-dup-${r.rowIndex}`,
            type: 'duplicate',
            severity: 'critical',
            title: 'Conflicting Duplicate Timestamp',
            timestamp: r.timestamp_ist,
            description: `Consumer ${r.consumer_number} recorded two different readings at the exact same second!`,
            details: `Reading 1: ${prev.meter_reading} kWh vs Reading 2: ${r.meter_reading} kWh`
          });
        }
      } else {
        seenTimestamps.set(tsKey, r);
      }
    });

    // Check for Out-of-Order Rows in CSV
    const lastSeenByConsumer: Record<string, MeterReading> = {};
    readings.forEach((r) => {
      const prev = lastSeenByConsumer[r.consumer_number];
      if (prev && r.timestamp_utc < prev.timestamp_utc) {
        if (alerts.filter(a => a.type === 'out_of_order').length < 20) {
          alerts.push({
            id: `ooo-${r.rowIndex}`,
            type: 'out_of_order',
            severity: 'info',
            title: 'Out-of-Order Telemetry Arrival',
            timestamp: r.timestamp_ist,
            description: `Reading for ${r.consumer_number} arrived out of chronological sequence in the transmission feed.`,
            details: `Arrived after ${prev.timestamp_ist}`
          });
        }
      }
      lastSeenByConsumer[r.consumer_number] = r;
    });

    // Check for Meter Reading Drops (Chronological)
    const grouped: Record<string, MeterReading[]> = {};
    readings.forEach((r) => {
      if (!grouped[r.consumer_number]) grouped[r.consumer_number] = [];
      grouped[r.consumer_number].push(r);
    });

    Object.entries(grouped).forEach(([consumer, list]) => {
      const sorted = [...list].sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (curr.meter_reading < prev.meter_reading) {
          const drop = prev.meter_reading - curr.meter_reading;
          const isCritical = drop > 10.0;
          alerts.push({
            id: `drop-${curr.rowIndex}`,
            type: 'meter_drop',
            severity: isCritical ? 'critical' : 'warning',
            title: isCritical ? 'Critical Meter Reset / Replacement' : 'Minor Meter Drop / Jitter',
            timestamp: curr.timestamp_ist,
            description: isCritical
              ? `Meter counter plummeted by ${drop.toFixed(1)} kWh for ${consumer}! Likely physical meter swap or memory rollback.`
              : `Meter reading dropped by ${drop.toFixed(3)} kWh for ${consumer} (ADC sensor quantization jitter).`,
            details: `Was ${prev.meter_reading} kWh -> Became ${curr.meter_reading} kWh (Change: -${drop.toFixed(3)})`
          });
        }
      }
    });

    return alerts;
  }, [readings]);

  // 4. FILTERING: Apply country, consumer, and date filters
  const filteredReadings = useMemo(() => {
    return readings.filter((r) => {
      if (selectedCountry !== 'All' && r.country !== selectedCountry) return false;
      if (selectedConsumer !== 'All' && r.consumer_number !== selectedConsumer) return false;

      const istDate = getISTDateString(r.timestamp_utc);
      if (startDate && istDate < startDate) return false;
      if (endDate && istDate > endDate) return false;

      return true;
    });
  }, [readings, selectedCountry, selectedConsumer, startDate, endDate]);

  const chronologicalReadings = useMemo(() => {
    return [...filteredReadings].sort((a, b) => a.timestamp_utc.localeCompare(b.timestamp_utc));
  }, [filteredReadings]);

  // 5. HOURLY AGGREGATION: max(reading) - min(reading) per UTC hour, displayed in IST
  const hourlyData = useMemo(() => {
    const buckets: Record<string, number[]> = {};

    filteredReadings.forEach((r) => {
      const utcHour = r.timestamp_utc.substring(0, 13) + ':00:00Z';
      if (!buckets[utcHour]) buckets[utcHour] = [];
      buckets[utcHour].push(r.meter_reading);
    });

    const hours = Object.keys(buckets).sort();
    const result: HourlyWindow[] = [];

    hours.forEach((utcHour) => {
      const vals = buckets[utcHour];
      const count = vals.length;
      const minReading = Math.min(...vals);
      const maxReading = Math.max(...vals);
      const consumption = maxReading - minReading;

      const istLabel = formatISTHourOnly(utcHour);
      const istDate = getISTDateString(utcHour);

      let status: HourlyWindow['status'] = 'normal';
      let statusReason = 'Normal verified consumption';

      if (count < 2) {
        status = 'incomplete';
        statusReason = `Incomplete interval: Only ${count} reading captured. Cannot verify delta span.`;
      } else if (consumption === 0) {
        status = 'zero';
        statusReason = 'Genuine zero consumption: Meter reading did not increment during this hour.';
      } else if (consumption > 15.0) {
        status = 'spike';
        statusReason = `Abnormal consumption spike of ${consumption.toFixed(2)} kWh detected! Exceeds upper limit.`;
      }

      result.push({
        hourId: utcHour,
        istLabel,
        istDate,
        readingCount: count,
        minReading,
        maxReading,
        consumption: parseFloat(consumption.toFixed(3)),
        status,
        statusReason
      });
    });

    return result;
  }, [filteredReadings]);

  // 6. METRIC TOTALS FOR KPI CARDS
  const totalConsumersCount = useMemo(() => {
    const s = new Set<string>();
    readings.forEach((r) => s.add(r.consumer_number));
    return s.size;
  }, [readings]);

  const totalFilteredConsumers = useMemo(() => {
    const s = new Set<string>();
    filteredReadings.forEach((r) => s.add(r.consumer_number));
    return s.size;
  }, [filteredReadings]);

  const totalConsumptionKwh = useMemo(() => {
    return hourlyData.reduce((acc, h) => acc + h.consumption, 0);
  }, [hourlyData]);

  const displayedAnomalies = useMemo(() => {
    return allAnomalies.filter((a) => {
      if (anomalyFilter !== 'All' && a.type !== anomalyFilter) return false;
      return true;
    });
  }, [allAnomalies, anomalyFilter]);

  // CSV Export
  const exportFilteredCSV = () => {
    if (hourlyData.length === 0) return;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Hour_IST,Hour_UTC,Readings_Count,Min_kWh,Max_kWh,Hourly_Consumption_kWh,Status,Reason']
        .concat(
          hourlyData.map(
            (h) =>
              `"${h.istLabel}","${h.hourId}",${h.readingCount},${h.minReading},${h.maxReading},${h.consumption},"${h.status}","${h.statusReason}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `energy_consumption_${selectedConsumer || 'filtered'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Loading Screen
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-700">
        <RefreshCw className="w-12 h-12 animate-spin text-emerald-600 mb-4" />
        <h2 className="text-xl font-bold">Loading Smart Meter Telemetry...</h2>
        <p className="text-sm text-slate-500 mt-2">Parsing 15,000 records & calculating IST aggregations...</p>
      </div>
    );
  }

  // Error Screen
  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-rose-50 text-rose-900 p-6">
        <AlertTriangle className="w-16 h-16 text-rose-600 mb-4" />
        <h2 className="text-2xl font-bold">Error Loading Dataset</h2>
        <p className="text-slate-700 mt-2">{errorMessage}</p>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // USER INTERFACE (HTML & COMPONENTS)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Smart Meter Energy Analytics Dashboard
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700">
                  IST (UTC+05:30)
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Elements Energy Technical Assignment • Real-Time Telemetry & Quality Audit Suite
              </p>
            </div>
          </div>

          <button
            onClick={exportFilteredCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm w-fit"
          >
            <Download className="w-4 h-4" />
            Export Hourly CSV
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* SECTION 1: CONTROLS & FILTERS */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3 text-slate-700 font-semibold text-sm">
            <Filter className="w-4 h-4 text-emerald-600" />
            Dashboard Controls & Filters
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Country
              </label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? '🌍 All Countries' : c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Consumer Meter
              </label>
              <select
                value={selectedConsumer}
                onChange={(e) => setSelectedConsumer(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {consumersForCountry.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? '⚡ All Consumers in Selection' : c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Start Date (IST)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                End Date (IST)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Compact summary line instead of chunky tile cards */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong className="text-slate-800 font-semibold">{totalFilteredConsumers}</strong> of {totalConsumersCount} Consumers
              </span>
              <span className="text-slate-300">•</span>
              <span>
                <strong className="text-slate-800 font-semibold">{filteredReadings.length.toLocaleString()}</strong> Readings
              </span>
              <span className="text-slate-300">•</span>
              <span>
                Total Consumption: <strong className="text-slate-800 font-semibold">{totalConsumptionKwh.toFixed(1)} kWh</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                {allAnomalies.length} Issues Flagged
              </span>
            </div>
          </div>
        </section>

        {/* SECTION 3: CHARTS */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Line Chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Cumulative Meter Reading Time-Series
                </h2>
                <p className="text-xs text-slate-500">
                  Continuous meter counter curve over time. Notice sudden drops or resets.
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                kWh Reading
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chronologicalReadings} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="timestamp_ist"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={Math.max(1, Math.floor(chronologicalReadings.length / 5))}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v) => `${v.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(val: any) => [`${parseFloat(val).toFixed(3)} kWh`, 'Meter Reading']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="meter_reading"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#2563eb' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              💡 <strong>Observation:</strong> If you select <strong>Brazil</strong> and <strong>BR-01-002</strong>, you will see a prominent vertical drop on Oct 3 from 16,663 kWh to 10,670 kWh where the physical meter was replaced.
            </div>
          </div>

          {/* Chart 2: Bar Chart */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  Hourly Electricity Consumption (IST)
                </h2>
                <p className="text-xs text-slate-500">
                  Calculated strictly as <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">max(reading) - min(reading)</code> within each UTC hour.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Normal
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Spike (&gt;15)
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="istLabel"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={Math.max(1, Math.floor(hourlyData.length / 5))}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    tickFormatter={(v) => `${v.toFixed(1)}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(val: any, _name: any, item: any) => [
                      `${val} kWh (${item.payload.readingCount} readings)`,
                      'Consumption'
                    ]}
                    labelFormatter={(label) => `Hour: ${label} IST`}
                  />
                  <ReferenceLine y={15} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Spike (15 kWh)', fill: '#f43f5e', fontSize: 10 }} />
                  <Bar dataKey="consumption" radius={[3, 3, 0, 0]}>
                    {hourlyData.map((entry, index) => {
                      let color = '#10b981'; // Emerald
                      if (entry.status === 'spike') color = '#f43f5e'; // Rose
                      if (entry.status === 'incomplete') color = '#f59e0b'; // Amber
                      if (entry.status === 'zero') color = '#64748b'; // Slate
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              💡 <strong>Legend:</strong> Green bars represent normal hourly usage (~9.6 kWh). Red bars indicate high usage spikes (&gt;15 kWh).
            </div>
          </div>
        </section>

        {/* SECTION 4: DATA QUALITY & ANOMALY LOG */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Data Quality & Anomaly Audit Log
              </h2>
              <p className="text-xs text-slate-500">
                Automated detection for duplicate records, out-of-order packets, meter drops, and abnormal consumption.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filter Issue:</span>
              <select
                value={anomalyFilter}
                onChange={(e) => setAnomalyFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="All">All Categories ({allAnomalies.length})</option>
                <option value="duplicate">Duplicates</option>
                <option value="meter_drop">Meter Drops / Resets</option>
                <option value="out_of_order">Out-of-Order Packets</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Timestamp (IST)</th>
                  <th className="py-2.5 px-3">Diagnosis & Explanation</th>
                  <th className="py-2.5 px-3">Reading Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedAnomalies.slice(0, 10).map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {alert.severity === 'critical' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          CRITICAL
                        </span>
                      )}
                      {alert.severity === 'warning' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          WARNING
                        </span>
                      )}
                      {alert.severity === 'info' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          INFO
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 capitalize whitespace-nowrap">
                      {alert.type.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {alert.timestamp}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-md">
                      {alert.description}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {alert.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {displayedAnomalies.length > 10 && (
            <div className="mt-3 text-center text-xs text-slate-400">
              Showing top 10 of {displayedAnomalies.length} detected anomaly events.
            </div>
          )}
        </section>

        {/* SECTION 5: HOURLY DRILL-DOWN TABLE */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Hourly Aggregation Drill-Down Table (IST)
              </h2>
              <p className="text-xs text-slate-500">
                Full audit trail showing starting reading, ending reading, and computed consumption per hour.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search hour or date..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr className="text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Hour Window (IST)</th>
                  <th className="py-2.5 px-3">Readings Count</th>
                  <th className="py-2.5 px-3">Min Reading (kWh)</th>
                  <th className="py-2.5 px-3">Max Reading (kWh)</th>
                  <th className="py-2.5 px-3">Hourly Consumption (kWh)</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hourlyData
                  .filter((h) => tableSearch === '' || h.istLabel.toLowerCase().includes(tableSearch.toLowerCase()))
                  .slice(0, 25)
                  .map((row) => (
                    <tr key={row.hourId} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                        {row.istLabel} IST
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {row.readingCount} readings
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {row.minReading.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {row.maxReading.toFixed(3)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {row.consumption.toFixed(3)} kWh
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {row.status === 'normal' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Normal
                          </span>
                        )}
                        {row.status === 'spike' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertTriangle className="w-3 h-3" /> Spike
                          </span>
                        )}
                        {row.status === 'incomplete' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Incomplete
                          </span>
                        )}
                        {row.status === 'zero' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                            Zero
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {row.statusReason}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-400 text-right">
            Displaying first 25 hourly windows. Use search to find specific dates.
          </div>
        </section>
      </main>
    </div>
  );
}

