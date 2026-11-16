// ============================================================================
// TYPES: Simple data structures used across our dashboard
// ============================================================================

// A single row from the CSV file
export interface MeterReading {
  consumer_number: string;
  timestamp_utc: string; // ISO string e.g. "2026-10-01T14:20:00Z"
  timestamp_ist: string; // Formatted IST string e.g. "01 Oct 2026, 07:50 PM"
  meter_reading: number; // Cumulative kWh counter
  country: string;
  rowIndex: number;      // Original line number in the CSV
}

// A 1-hour time window for consumption
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

// A detected data-quality issue or anomaly
export interface AnomalyAlert {
  id: string;
  type: 'duplicate' | 'out_of_order' | 'meter_drop' | 'consumption_spike' | 'incomplete_window';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  timestamp: string;     // IST formatted timestamp
  description: string;   // Plain English reason why it was flagged
  details: string;       // Additional technical detail (e.g. drop value)
}
