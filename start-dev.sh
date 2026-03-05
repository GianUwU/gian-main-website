#!/bin/bash
# start-dev.sh - Start all development servers (main, drop, and finance apps)

echo "Starting all backend services..."
cd PythonBackend
docker-compose up --build -d
cd ..

echo "Starting main-app on port 5173..."
cd main-app
npm run dev > /tmp/main-app-dev.log 2>&1 &
echo $! > /tmp/main-app-dev.pid
cd ..

echo "Starting drop-app on port 5174..."
cd drop-app
npm run dev -- --port 5174 > /tmp/drop-app-dev.log 2>&1 &
echo $! > /tmp/drop-app-dev.pid
cd ..

echo "Starting finance-app on port 5175..."
cd finance-app
npm run dev -- --port 5175 > /tmp/finance-app-dev.log 2>&1 &
echo $! > /tmp/finance-app-dev.pid
cd ..

echo "Starting flavia-app on port 5176..."
cd flavia-app
npm run dev -- --port 5176 > /tmp/flavia-app-dev.log 2>&1 &
echo $! > /tmp/flavia-app-dev.pid
cd ..

echo "All services started. Use ./stop-dev.sh to stop."
echo ""
echo "Backends:"
echo "  Main:     http://localhost:8000 (auth, portal)"
echo "  Drop:     http://localhost:8001 (file sharing)"
echo "  Finance:  http://localhost:8002 (finance tracker)"
echo ""
echo "Frontends:"
echo "  Main:     http://localhost:5173 (gian.ink portal)"
echo "  Drop:     http://localhost:5174 (drop.gian.ink)"
echo "  Finance:  http://localhost:5175 (finance.gian.ink)"
echo "  Flavia:   http://localhost:5176 (flavia.gian.ink)"
