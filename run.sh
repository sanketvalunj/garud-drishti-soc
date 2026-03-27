#!/bin/bash
# ---------------------------------------------------------
# GARUD-DRISHTI Full Project Execution Pipeline
# ---------------------------------------------------------

echo "🦅 Starting Garud-Drishti Pipeline..."

# Activate Virtual Environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "❌ venv not found. Please create it first."
    exit 1
fi

export PYTHONPATH=.

echo "⚙️  Generating fake logs..."
python3 garud_drishti/scripts/generate_fake_logs.py || exit 1

echo "⚙️  Running schema mapper..."
python3 garud_drishti/ingestion/schema_mapper.py || exit 1

echo "⚙️  Running safe mapper..."
python3 garud_drishti/ingestion/safe_mapper.py || exit 1

echo "⚙️  Running schema validator..."
python3 garud_drishti/ingestion/schema_validator.py || exit 1

echo "⚙️  Running normalize logs script..."
python3 garud_drishti/ingestion/normalize_logs.py || exit 1

echo "⚙️  Running normalize logs module..."
python3 -m garud_drishti.ingestion.normalize_logs \
--input garud_drishti/data/raw_logs \
--output garud_drishti/data/normalized_events \
--report || exit 1

echo "⚙️  Extracting features..."
python3 scripts/extract_features.py || exit 1

echo "⚙️  Detecting anomalies..."
python3 scripts/detect_anomalies.py || exit 1

echo "⚙️  Running correlation pipeline..."
python3 garud_drishti/correlation_engine/correlation_pipeline.py || exit 1

echo "✅ Pipeline complete!"
