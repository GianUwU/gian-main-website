#!/bin/bash

# Script to generate secure JWT secrets for NodeJsBackend

echo "🔐 Generating JWT secrets for NodeJsBackend"
echo "========================================"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed"
    exit 1
fi

# Generate the key
ACCESS_TOKEN_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
REFRESH_TOKEN_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")

echo "✅ Generated secrets:"
echo ""
echo "ACCESS_TOKEN_SECRET=$ACCESS_TOKEN_SECRET"
echo "REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET"
echo ""
echo "📝 Add these to NodeJsBackend/.env on your server:"
echo ""
echo "ACCESS_TOKEN_SECRET=$ACCESS_TOKEN_SECRET"
echo "REFRESH_TOKEN_SECRET=$REFRESH_TOKEN_SECRET"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Keep this key secret and secure!"
echo "   - Don't commit it to version control"
echo "   - Changing it will log out all users"
echo "   - Use different keys for dev and production"
echo ""
