#!/bin/bash

# Migration script to add 'order' column to transaction_categories table

echo "Checking transaction_categories table structure..."

# First check if column already exists
EXISTING=$(sqlite3 finance.db "PRAGMA table_info(transaction_categories);" | grep -i '|order|' || echo "")

if [ ! -z "$EXISTING" ]; then
    echo "✅ 'order' column already exists!"
    exit 0
fi

echo "Adding 'order' column to transaction_categories table..."

# Try to add the column with explicit error output
RESULT=$(sqlite3 finance.db "ALTER TABLE transaction_categories ADD COLUMN \"order\" INTEGER DEFAULT 0;" 2>&1)
STATUS=$?

if [ $STATUS -eq 0 ]; then
    echo "✅ Successfully added 'order' column!"
    exit 0
else
    echo "Error output: $RESULT"
    
    # Try alternative syntax without quotes
    echo "Trying alternative syntax..."
    RESULT=$(sqlite3 finance.db "ALTER TABLE transaction_categories ADD COLUMN order_pos INTEGER DEFAULT 0;" 2>&1)
    STATUS=$?
    
    if [ $STATUS -eq 0 ]; then
        echo "✅ Successfully added 'order_pos' column (order is reserved keyword)!"
        exit 0
    else
        echo "❌ Error: $RESULT"
        exit 1
    fi
fi
