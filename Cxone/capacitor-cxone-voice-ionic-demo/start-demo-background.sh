#!/bin/bash

echo "Starting CXONE Voice Demo App in background..."
echo ""

# Kill any existing ionic processes
pkill -f ionic 2>/dev/null

echo "Installing dependencies (this may take a few minutes)..."
npm install --legacy-peer-deps

echo ""
echo "Starting Ionic development server in background..."
echo "The app will be available at http://localhost:8100"
echo ""

# Start the Ionic server in background
nohup npx ionic serve > ionic-serve.log 2>&1 &

echo "Server starting... Check ionic-serve.log for details"
echo "To stop the server, run: pkill -f ionic"