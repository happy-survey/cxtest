#!/bin/bash

echo "Starting CXONE Voice Demo App..."
echo "This will open in your browser at http://localhost:8100"
echo ""
echo "Installing dependencies (this may take a few minutes)..."

# Install dependencies
npm install --legacy-peer-deps

echo ""
echo "Starting Ionic development server..."
echo "Press Ctrl+C to stop the server"
echo ""

# Start the Ionic server
npx ionic serve