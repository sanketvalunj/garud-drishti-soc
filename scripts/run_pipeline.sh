#!/bin/bash

echo "🦅 Launching Garud-Drishti Full Prototype..."
echo "------------------------------------------"

cd "$(dirname "$0")/.."

# -----------------------
# Activate virtual env
# -----------------------
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "❌ venv not found"
    exit 1
fi

# -----------------------
# Ensure imports work
# -----------------------
export PYTHONPATH=.
echo "✅ PYTHONPATH set"

# -----------------------
# Clean previous outputs
# -----------------------
echo "🧹 Cleaning previous data..."
rm -rf data/incident_records/*
rm -rf data/model_features/*
rm -rf data/normalized_events/*
echo "✅ Clean state ready"

# -----------------------
# Run pipeline scripts
# -----------------------
echo ""
echo "⚙️ Running SOC pipeline..."

python3 garud_drishti/scripts/generate_fake_logs.py || exit 1
python3 garud_drishti/ingestion/schema_mapper.py || exit 1
python3 garud_drishti/ingestion/schema_validator.py || exit 1
python3 garud_drishti/ingestion/normalize_logs.py || exit 1

python3 -m garud_drishti.ingestion.normalize_logs \
--input garud_drishti/data/raw_logs \
--output garud_drishti/data/normalized_events \
--report || exit 1

python3 scripts/extract_features.py || exit 1
python3 scripts/detect_anomalies.py || exit 1
python3 garud_drishti/correlation_engine/correlation_pipeline.py || exit 1

echo "✅ Pipeline completed"

# -----------------------
# Start AI engine
# -----------------------
echo ""
echo "🧠 Starting AI Engine..."
bash scripts/start_ai_engine.sh &
sleep 2

# -----------------------
# Start backend
# -----------------------
echo ""
echo "🌐 Starting Backend..."
echo "Dashboard: http://127.0.0.1:8000"
echo "Docs:      http://127.0.0.1:8000/docs"
echo ""

bash scripts/start_backend.sh
