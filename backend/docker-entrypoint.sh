#!/bin/sh
set -e

echo "Initializing database tables..."
python init_db.py

echo "Seeding database..."
python seed.py || echo "Seed skipped (may already exist)"

echo "Starting FastAPI server..."
exec uvicorn app.main:socket_app --host 0.0.0.0 --port ${PORT:-5000}
