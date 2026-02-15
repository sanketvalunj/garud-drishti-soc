#!/bin/bash

echo "🦅 Launching Garud-Drishti Full Pipeline..."

cd "$(dirname "$0")/.."

# Activate venv
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
fi

echo "🔹 Step 1: Starting AI Engine..."
bash scripts/start_ai_engine.sh &

sleep 2

echo "🔹 Step 2: Starting Backend..."
bash scripts/start_backend.sh