#!/bin/bash

echo "🧠 Starting Garud-Drishti AI Engine..."
echo "-------------------------------------"

cd "$(dirname "$0")/.."

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "⚠️ No virtual environment found"
fi

# Ensure imports work
export PYTHONPATH=.

echo "⚙️ Initializing reasoning modules..."
sleep 1
echo "⚙️ Loading correlation engine..."
sleep 1
echo "⚙️ Loading playbook generator..."
sleep 1

# Ollama startup guidance
if command -v ollama >/dev/null 2>&1; then
    if curl -s "http://127.0.0.1:11434/api/tags" >/dev/null 2>&1; then
        echo "🤖 Ollama detected and running"
    else
        echo "⚠️ Ollama is installed but not running."
        echo "👉 First run in another terminal: ollama serve"
        echo "👉 Then start/restart this AI engine script."
        exit 1
    fi
else
    echo "❌ Ollama CLI not found. Install Ollama and run: ollama serve"
    exit 1
fi

echo "🧠 AI Engine ready"

echo ""
echo "⚙️ Running SOC AI pipeline (offline) ..."
python3 scripts/run_soc_pipeline.py || exit 1
echo "✅ AI pipeline completed"
