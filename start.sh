#!/bin/bash

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please create it and add GOOGLE_API_KEY."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Ingest documents if DB doesn't exist
if [ ! -d "chroma_db" ]; then
    echo "Indexing documents..."
    python3 ingest.py
fi

# Start backend
echo "Starting backend server..."
python3 main.py
