import pandas as pd

def build_timeline_groups(df, window_minutes=10):
    df = df.copy()

    if "timestamp" not in df.columns:
        raise ValueError("timestamp column missing")

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp")

    groups = []
    current = []
    last_time = None
    window = pd.Timedelta(minutes=window_minutes)

    for _, row in df.iterrows():

        if last_time is None:
            current.append(row)
            last_time = row["timestamp"]
            continue

        if row["timestamp"] - last_time <= window:
            current.append(row)
        else:
            groups.append(pd.DataFrame(current))
            current = [row]

        last_time = row["timestamp"]

    if current:
        groups.append(pd.DataFrame(current))

    return groups