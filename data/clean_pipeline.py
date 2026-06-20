import pandas as pd

# Load the data
trips = pd.read_csv("data/yellow_tripdata_2019-01.csv")
zones = pd.read_csv("data/taxi_zone_lookup.csv")

print("Rows loaded:", len(trips))

trips["tpep_pickup_datetime"] = pd.to_datetime(trips["tpep_pickup_datetime"])
trips["tpep_dropoff_datetime"] = pd.to_datetime(trips["tpep_dropoff_datetime"])

# Track excluded records
excluded_records = []

# Remove trips where dropoff is before pickup
bad_time = trips["tpep_dropoff_datetime"] <= trips["tpep_pickup_datetime"]
excluded_records.append(trips[bad_time].copy().assign(reason="dropoff before pickup"))
trips = trips[~bad_time]

# Remove trips with zero or negative distance
bad_distance = trips["trip_distance"] <= 0
excluded_records.append(trips[bad_distance].copy().assign(reason="invalid distance"))
trips = trips[~bad_distance]

# Remove trips with distance over 150 miles
too_far = trips["trip_distance"] > 150
excluded_records.append(trips[too_far].copy().assign(reason="distance over 150 miles"))
trips = trips[~too_far]

# Remove trips with zero or negative fare
bad_fare = trips["fare_amount"] <= 0
excluded_records.append(trips[bad_fare].copy().assign(reason="invalid fare"))
trips = trips[~bad_fare]

# Remove trips with fare over $500
too_expensive = trips["fare_amount"] > 500
excluded_records.append(trips[too_expensive].copy().assign(reason="fare over 500"))
trips = trips[~too_expensive]

# Remove trips with invalid passenger count
bad_passengers = (trips["passenger_count"] <= 0) | (trips["passenger_count"] > 6)
excluded_records.append(trips[bad_passengers].copy().assign(reason="invalid passenger count"))
trips = trips[~bad_passengers]

# Remove trips that are not from 2019
wrong_year = trips["tpep_pickup_datetime"].dt.year != 2019
excluded_records.append(trips[wrong_year].copy().assign(reason="wrong year"))
trips = trips[~wrong_year]

print("Clean rows remaining:", len(trips))

# Save exclusion log
all_excluded = pd.concat(excluded_records, ignore_index=True)
all_excluded.to_csv("data/exclusion_log.csv", index=False)
print("Excluded rows saved to data/exclusion_log.csv:", len(all_excluded))

# Save cleaned data
trips.to_csv("data/cleaned_trips.csv", index=False)
print("Cleaned data saved to data/cleaned_trips.csv")