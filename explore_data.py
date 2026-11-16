import csv
from datetime import datetime, timezone, timedelta

# IST is UTC + 5 hours 30 minutes
IST = timezone(timedelta(hours=5, minutes=30))

# 1. Read all rows from the CSV
with open("smart_meter_data.csv", mode="r", encoding="utf-8") as file:
    rows = list(csv.DictReader(file))

print("==================================================")
print("PART 4: HOURLY CONSUMPTION CALCULATION")
print("==================================================")

# 2. Group readings into 1-hour buckets for each house
# Key: (house_id, utc_hour_string) -> List of meter readings in that hour
hourly_buckets = {}

for row in rows:
    house = row["consumer_number"]
    ts_str = row["timestamp_utc"]  # Example: "2026-10-01T14:25:30Z"
    
    # Extract just the date and hour: "2026-10-01 14:00"
    utc_hour = ts_str[:13] + ":00:00Z"
    reading = float(row["meter_reading"])
    
    bucket_key = (house, utc_hour)
    if bucket_key not in hourly_buckets:
        hourly_buckets[bucket_key] = []
        
    hourly_buckets[bucket_key].append(reading)

# 3. Calculate consumption for each hour: max - min
all_hourly_consumptions = []
sample_consumer_results = []

for (house, utc_hour), readings in hourly_buckets.items():
    # Formula from assignment: max reading minus min reading
    min_val = min(readings)
    max_val = max(readings)
    consumption = max_val - min_val
    reading_count = len(readings)
    
    # Convert the hour to Indian Standard Time (IST)
    dt_utc = datetime.fromisoformat(utc_hour.replace("Z", "+00:00"))
    dt_ist = dt_utc.astimezone(IST)
    ist_label = dt_ist.strftime("%Y-%m-%d %I:%M %p IST")
    
    entry = {
        "house": house,
        "utc_hour": utc_hour,
        "ist_hour": ist_label,
        "min": min_val,
        "max": max_val,
        "consumption": consumption,
        "count": reading_count
    }
    
    all_hourly_consumptions.append(entry)
    
    # Save a few sample hours for House 'IN-04-001' to display
    if house == "IN-04-001":
        sample_consumer_results.append(entry)

# 4. Display 5 sample hours for India House 1
print("\nSample Hourly Calculations for House 'IN-04-001' (India):")
print("-" * 75)
print(f"{'Hour in IST':<24} | {'Min (kWh)':<10} | {'Max (kWh)':<10} | {'Usage (kWh)':<11} | {'Readings'}")
print("-" * 75)

# Sort by time so it displays chronologically
sample_consumer_results.sort(key=lambda x: x["utc_hour"])
for h in sample_consumer_results[:5]:
    print(f"{h['ist_hour']:<24} | {h['min']:<10.3f} | {h['max']:<10.3f} | {h['consumption']:<11.3f} | {h['count']} readings")

print("-" * 75)

# 5. Summary statistics across all 15 houses
total_windows = len(all_hourly_consumptions)
all_values = [h["consumption"] for h in all_hourly_consumptions]
avg_consumption = sum(all_values) / len(all_values)
max_consumption = max(all_values)
min_consumption = min(all_values)

print(f"\nOverall Summary Across All 15 Houses:")
print(f"• Total 1-hour windows calculated: {total_windows} hours (15 houses x 120 hours each)")
print(f"• Average usage per hour:          {avg_consumption:.2f} kWh")
print(f"• Lowest hour usage:               {min_consumption:.2f} kWh")
print(f"• Highest hour usage:              {max_consumption:.2f} kWh")

# Find the hour with the highest usage
highest_entry = max(all_hourly_consumptions, key=lambda x: x["consumption"])
print(f"\nBiggest power spike occurred at:")
print(f"• House: {highest_entry['house']}")
print(f"• Time:  {highest_entry['ist_hour']}")
print(f"• Usage: {highest_entry['consumption']:.3f} kWh (went from {highest_entry['min']} to {highest_entry['max']})")
print("==================================================")
