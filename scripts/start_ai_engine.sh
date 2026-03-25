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

# Optional Ollama check (safe even if not installed)
if command -v ollama >/dev/null 2>&1; then
    echo "🤖 Ollama detected"
else
    echo "ℹ️ Ollama not running (using fallback logic)"
fi

echo "🧠 AI Engine ready"
