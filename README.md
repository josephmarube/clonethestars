# NYC Mobility Explorer - Technical Report

## 1. Problem Framing and Dataset Analysis

### Dataset Description

The NYC Yellow Taxi Trip dataset contains trip records from January 2019, provided by the New York City Taxi and Limousine Commission (TLC). The dataset captures detailed information about individual taxi trips including pickup and dropoff timestamps, locations (represented by zone IDs), passenger counts, trip distances, fare breakdowns, payment methods, and various surcharges.

### Data Challenges

**Missing Fields:**
- Some records had NULL values in `PULocationID` and `DOLocationID`
- Payment type was missing in approximately 2% of records
- Rate code ID was null for many trips

**Outliers and Anomalies:**

| Issue | Threshold | Count Removed |
|-------|-----------|---------------|
| Dropoff before pickup | dropoff_datetime <= pickup_datetime | ~150,000 |
| Invalid distance | trip_distance <= 0 | ~120,000 |
| Excessive distance | trip_distance > 150 miles | ~50,000 |
| Invalid fare | fare_amount <= 0 or > $500 | ~110,000 |
| Invalid passenger count | passenger_count <= 0 or > 6 | ~20,000 |
| Wrong year | pickup year != 2019 | ~7,770 |

**Temporal Anomalies:**
- Some trips showed unrealistic durations (e.g., 3-hour trips for 1-mile distances)
- Congestion surcharge was NULL for all January 2019 trips (feature wasn't active yet)

### Data Cleaning Assumptions

1. **Fare Amount**: Trips with fare_amount <= 0 were removed as these represent either data entry errors or zero-fare trips (not meaningful for analysis). Trips with fare_amount > $500 were removed as outliers representing limousine or luxury services, not typical yellow taxi trips.

2. **Trip Distance**: Zero or negative distances were removed as data errors. Trips exceeding 150 miles were removed as outliers representing intercity travel.

3. **Passenger Count**: Values between 1-6 are considered valid. Zero represents data error; >6 represents unusual circumstances.

4. **Temporal Logic**: Dropoff must occur after pickup. Records failing this were removed.

5. **Year Filter**: Only 2019 data was kept to maintain dataset consistency.

### Unexpected Observation

During analysis, we discovered that Staten Island trips have significantly longer average distances (6.2 miles) compared to Manhattan (3.1 miles), yet Manhattan's average fare is $12.50 compared to Staten Island's $8.20. This indicates Manhattan has higher density, more short trips, and potentially higher base fares or congestion pricing effects. This influenced our design to include per-borough scaling on the map rather than global scaling, revealing patterns that would otherwise be hidden.

---

## 2. System Architecture and Design Decisions


### Stack Justification

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Backend Framework | Flask | Lightweight, simple to set up, perfect for single-file API |
| Database | SQLite | No separate server needed, handles 7.49M rows efficiently with WAL mode |
| Frontend | Vanilla JS | No framework overhead, direct DOM manipulation, faster load times |
| Charts | Chart.js | Simple API, responsive, good browser support |
| Mapping | Leaflet.js | Lightweight, GeoJSON support, free tile layers |
| Caching | SessionStorage | Simple, no server-side cache setup needed |

### Schema Design

**Normalization Level:** 3NF (Third Normal Form)

**Tables:**

**zones (Dimension Table):**
| Column | Type | Description |
|--------|------|-------------|
| zone_id | INTEGER PK | TLC location ID |
| borough | TEXT | NYC borough |
| zone_name | TEXT | Human-readable name |
| service_zone | TEXT | Yellow/Green zone |

**trips (Fact Table):**
| Column | Type | Description |
|--------|------|-------------|
| trip_id | INTEGER PK | Auto-increment |
| vendor_id, pickup_datetime, dropoff_datetime | various | Raw trip data |
| passenger_count, trip_distance | INTEGER/REAL | Trip metrics |
| pu_location_id, do_location_id | INTEGER | FK to zones |
| fare_amount, tip_amount, total_amount | REAL | Financial metrics |
| trip_speed_mph, time_of_day, fare_per_mile, is_weekend | various | Derived features |

**summary_cache (Aggregate Table):**
| Column | Type | Description |
|--------|------|-------------|
| total_trips, total_revenue, avg_fare, avg_distance, avg_tip_pct, peak_hour | various | Pre-calculated KPI data |
| borough-specific metrics | various | Per-borough pre-calculated data |

### Trade-offs

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| SQLite vs PostgreSQL | PostgreSQL has better concurrency, SQLite is simpler | Small team, educational project, SQLite sufficient |
| SessionStorage vs Redis | Redis is faster, SessionStorage is simpler | No need for server-side caching |
| 50 trips per page vs 200 | Smaller pages = more API calls, larger pages = slower loads | Balanced at 50 for UX |
| Per-borough vs global color scaling | Per-borough shows patterns, global shows comparisons | Per-borough reveals hidden patterns in each borough |
| GeoJSON in frontend vs database | Frontend loads once, database would be faster | Simpler implementation, map renders locally |

---

## 3. Algorithmic Logic and Data Structures

### Problem Definition

The NYC taxi dataset contains 265 zones with varying trip counts. The application needs to display the top K pickup zones on the dashboard. While SQL's `ORDER BY` and `LIMIT` could solve this, the assignment requires implementing a custom algorithm without using built-in libraries.

### Algorithm: Manual Selection Sort for Top K Routes

**Approach:**

Instead of sorting all 265 zones (which would be O(N log N)), we use a selection-based approach that only finds the top K elements. This is more efficient when K is small (default is 10) compared to N (265).

**Pseudo-code:**

```
function top_k_routes(zone_counts, k):
    // Input: dictionary of {zone_name: trip_count}
    // Output: list of top K zones [(name, count), ...]
    
    // 1. Convert dictionary to list of [name, count] pairs
    items = []
    for each (name, count) in zone_counts:
        items.append([name, count])
    
    n = length(items)
    k = min(k, n)  // Can't return more than available
    used = array of false (size n)
    result = []
    
    // 2. Find top K using selection
    for i = 0 to k-1:
        best_index = -1
        best_value = -1
        
        for j = 0 to n-1:
            if not used[j] and items[j][1] > best_value:
                best_value = items[j][1]
                best_index = j
        
        if best_index == -1:
            break
        
        used[best_index] = true
        result.append((items[best_index][0], items[best_index][1]))
    
    return result
```

**Time Complexity:** O(K * N)
- N = number of zones (265)
- K = number of top zones to find (default 10)
- Best case: K = 1 → O(N)
- Worst case: K = N → O(N²)

**Space Complexity:** O(N)
- items array: O(N)
- used array: O(N)
- result array: O(K)

**Why This Algorithm:**

1. **Efficiency**: When K is small relative to N (10 vs 265), this is faster than sorting all elements
2. **Simplicity**: Easy to understand and implement
3. **No built-in dependencies**: Does not use `heapq`, `Counter`, `sort()`, or `sorted()`
4. **Deterministic**: Always produces the same result for the same input

### Implementation

```python
def top_k_routes(zone_counts: dict, k: int) -> list:
    if not zone_counts or k <= 0:
        return []
    
    # Convert dictionary to list for manual processing
    items = [[name, cnt] for name, cnt in zone_counts.items()]
    n = len(items)
    k = min(k, n)
    used = [False] * n
    result = []
    
    for _ in range(k):
        best_idx = -1
        best_val = -1
        for i in range(n):
            if not used[i] and items[i][1] > best_val:
                best_val = items[i][1]
                best_idx = i
        if best_idx == -1:
            break
        used[best_idx] = True
        result.append((items[best_idx][0], items[best_idx][1]))
    
    return result
```

---

## 4. Insights and Interpretation

### Insight 1: Manhattan Dominates Taxi Activity

**How derived:** SQL query aggregating trips by pickup borough.

```sql
SELECT 
    pz.borough, 
    COUNT(*) AS trip_count,
    ROUND(AVG(t.fare_amount), 2) AS avg_fare
FROM trips t
LEFT JOIN zones pz ON t.pu_location_id = pz.zone_id
WHERE pz.borough IS NOT NULL
GROUP BY pz.borough
ORDER BY trip_count DESC;
```

**Visualization:** Borough breakdown bar chart.

**Interpretation:**
Manhattan accounts for 43% of all taxi trips in January 2019. This indicates Manhattan is the economic and tourism center of NYC with the highest demand for taxi services. The data suggests that ride-hailing regulations, traffic management, and infrastructure investments should prioritize Manhattan, while also considering the unique patterns of outer boroughs.

### Insight 2: Peak Hour is 6 PM

**How derived:** Hourly aggregation query using SQL `strftime`.

```sql
SELECT 
    CAST(strftime('%H', pickup_datetime) AS INTEGER) AS hour,
    COUNT(*) AS trip_count
FROM trips
WHERE pickup_datetime IS NOT NULL
GROUP BY hour
ORDER BY trip_count DESC
LIMIT 1;
```

**Visualization:** Hourly bar chart with peak highlighted.

**Interpretation:**
The peak hour is 18:00 (6 PM) with approximately 320,000 trips. This coincides with the evening rush hour when people are leaving work, heading to dinner, or attending evening events. This insight is valuable for:
- Taxi dispatch optimization
- Surge pricing strategies
- Traffic management during peak hours
- Airport and transit hub planning

### Insight 3: Card Payments Dominate

**How derived:** Payment type aggregation.

```sql
SELECT 
    payment_type,
    COUNT(*) AS trip_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM trips), 2) AS percentage
FROM trips
WHERE payment_type IS NOT NULL
GROUP BY payment_type
ORDER BY trip_count DESC;
```

**Visualization:** Donut chart.

**Interpretation:**
Credit card payments account for 65% of all trips, while cash represents only 30%. This indicates a strong preference for electronic payments, likely driven by:
- Convenience for passengers
- Contactless payment adoption
- App-based ride-hailing competition
- Reduced fraud risk for drivers

This insight suggests that future infrastructure should prioritize electronic payment systems and that cashless policies could be viable.

---

## 5. Reflection and Future Work

### Technical Challenges

1. **Data Volume**: Processing 7.49 million records required careful consideration of memory usage and performance. We addressed this with chunked processing (100K rows per batch) and SQLite WAL mode.

2. **Map Performance**: Rendering 263 zones with complex polygons was slow. We optimized by simplifying polygon styles and using per-borough coloring.

3. **Dashboard Speed**: Initial load was slow due to multiple API calls. We implemented:
   - SessionStorage caching (5-minute TTL)
   - Database indexing on all foreign keys
   - Pre-calculated summary_cache table

### Team Challenges

1. **Task Dependencies**: Person 2 needed to complete schema.sql before Person 1 could start data insertion. We solved this by prioritizing the schema design first.

2. **Integration**: API response formats needed coordination between Person 2 (backend) and Person 3 (frontend). We used early prototyping with mock data.

3. **Data Consistency**: Ensuring the same data across development environments was challenging. We committed the schema and used relative paths for data files.

### What We Learned

1. **Indexes are Critical**: Without proper indexing, queries on 7.49M rows take 30+ seconds. With indexing, most queries execute in < 200ms.

2. **Caching Matters**: The summary_cache table reduced KPI card load time from 5+ seconds to < 100ms.

3. **User Experience**: Loading states and pagination significantly improve perceived performance.

### Future Improvements

1. **Time-Series Analysis**: Add day-over-day and week-over-week comparisons to identify trends.

2. **Predictive Modeling**: Use historical data to forecast trip demand and fare revenue.

3. **Real-Time Data**: Integrate with live TLC data feed for real-time monitoring.

4. **User Authentication**: Allow users to save custom filters and dashboards.

5. **Deployment**: Deploy to cloud (Render/Heroku/AWS) for public access.

6. **Additional Data Sources**: Integrate with weather data, event data, and subway ridership for richer insights.

7. **Mobile App**: Build a React Native or Flutter mobile version for on-the-go access.

8. **Advanced Analytics**: Add clustering analysis to identify similar zones, anomaly detection for unusual trip patterns, and route optimization.

---

