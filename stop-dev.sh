#!/bin/bash
# stop-dev.sh - Stop all development servers

echo "Stopping main-app..."
if [ -f /tmp/main-app-dev.pid ]; then
    kill $(cat /tmp/main-app-dev.pid) 2>/dev/null
    rm /tmp/main-app-dev.pid
fi

echo "Stopping drop-app..."
if [ -f /tmp/drop-app-dev.pid ]; then
    kill $(cat /tmp/drop-app-dev.pid) 2>/dev/null
    rm /tmp/drop-app-dev.pid
fi

echo "Stopping finance-app..."
if [ -f /tmp/finance-app-dev.pid ]; then
    kill $(cat /tmp/finance-app-dev.pid) 2>/dev/null
    rm /tmp/finance-app-dev.pid
fi

echo "Stopping flavia-app..."
if [ -f /tmp/flavia-app-dev.pid ]; then
    kill $(cat /tmp/flavia-app-dev.pid) 2>/dev/null
    rm /tmp/flavia-app-dev.pid
fi

echo "Stopping Node backends..."
cd NodeJsBackend
docker compose down
cd ..

echo "All services stopped."
