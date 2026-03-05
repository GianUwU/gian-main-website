#!/bin/bash

# Script to generate a secure SECRET_KEY for production deployment

echo "🔐 Generating Secure SECRET_KEY for JWT"
echo "========================================"
echo ""

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed"
    exit 1
fi

# Generate the key
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

echo "✅ Generated secure SECRET_KEY:"
echo ""
echo "    $SECRET_KEY"
echo ""
echo "📝 Copy this and replace the SECRET_KEY in PythonBackend/finance.py:"
echo ""
echo "    SECRET_KEY = \"$SECRET_KEY\""
echo ""
echo "⚠️  IMPORTANT:"
echo "   - Keep this key secret and secure!"
echo "   - Don't commit it to version control"
echo "   - Changing it will log out all users"
echo "   - Use different keys for dev and production"
echo ""
