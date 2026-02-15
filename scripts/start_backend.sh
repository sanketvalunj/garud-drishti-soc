#!/bin/bash

echo "🚀 Starting Garud-Drishti Backend..."

# Move to project root (script may run from anywhere)
cd "$(dirname "$0")/.."

# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "⚠️ No virtual environment found"
fi

# Start backend
echo "🌐 Launching FastAPI server..."
python -m uvicorn garud_drishti.backend.main:app --host 0.0.0.0 --port 8000 --reload