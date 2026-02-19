#!/bin/bash

echo "🚀 Starting Garud-Drishti Backend..."
echo "------------------------------------"

cd "$(dirname "$0")/.."

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "⚠️ No virtual environment found"
fi

# Ensure Python imports work
export PYTHONPATH=.

echo ""
echo "🌐 Launching FastAPI server..."
echo "Dashboard: http://127.0.0.1:8000"
echo "Docs:      http://127.0.0.1:8000/docs"
echo ""

python -m uvicorn garud_drishti.backend.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
