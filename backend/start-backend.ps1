# start-backend.ps1
# This script ensures port 5000 is free and starts the backend server.

$port = 5000
echo "🔍 Checking for processes on port $port..."

$processId = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue).OwningProcess

if ($processId) {
    echo "⚡ Killing process $processId on port $port..."
    Get-Process -Id $processId | Stop-Process -Force
    # Wait a moment for the OS to release the port
    Start-Sleep -Seconds 1
} else {
    echo "✅ Port $port is already free."
}

echo "🚀 Starting backend server..."
npm run dev
