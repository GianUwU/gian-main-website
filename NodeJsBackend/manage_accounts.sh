#!/bin/bash
# manage_accounts.sh - User account management script for the authentication system

DB_PATH="auth.db"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database $DB_PATH not found!"
    exit 1
fi

# Function to hash password (SHA256)
hash_password() {
    echo -n "$1" | sha256sum | awk '{print $1}'
}

# Function to list all users
list_users() {
    echo "=== All Users ==="
    
    # Get all users from auth database
    sqlite3 "$DB_PATH" "SELECT id, username, CASE WHEN is_admin = 1 THEN 'Yes' ELSE 'No' END as admin, created_at FROM users ORDER BY username;" | while IFS='|' read -r user_id username admin created_at; do
        # Count transactions from finance database
        transaction_count=0
        if [ -f "finance.db" ]; then
            transaction_count=$(sqlite3 "finance.db" "SELECT COUNT(*) FROM transactions WHERE user_id = $user_id;" 2>/dev/null || echo "0")
        fi
        
        # Count files from drop database
        file_count=0
        if [ -f "drop_files.db" ]; then
            file_count=$(sqlite3 "drop_files.db" "SELECT COUNT(*) FROM files WHERE user_id = $user_id;" 2>/dev/null || echo "0")
        fi
        
        # Format and display the user info
        printf "%-4s | %-20s | Admin: %-3s | Transactions: %-4s | Files: %-4s | Created: %s\n" \
            "$user_id" "$username" "$admin" "$transaction_count" "$file_count" "$created_at"
    done
}

# Function to delete a user
delete_user() {
    read -p "Enter username to delete: " username
    
    # Check if user exists
    user_exists=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE username = '$username';")
    
    if [ "$user_exists" -eq 0 ]; then
        echo "Error: User '$username' not found!"
        return 1
    fi
    
    # Confirm deletion
    read -p "Are you sure you want to delete user '$username'? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Deletion cancelled."
        return 0
    fi
    
    # Delete user (cascade will delete refresh tokens)
    sqlite3 "$DB_PATH" "DELETE FROM users WHERE username = '$username';"
    
    if [ $? -eq 0 ]; then
        echo "✓ User '$username' deleted successfully."
    else
        echo "Error: Failed to delete user '$username'."
        return 1
    fi
}

# Function to reset password
reset_password() {
    read -p "Enter username: " username
    
    # Check if user exists
    user_exists=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE username = '$username';")
    
    if [ "$user_exists" -eq 0 ]; then
        echo "Error: User '$username' not found!"
        return 1
    fi
    
    # Get new password
    read -sp "Enter new password: " password
    echo
    read -sp "Confirm new password: " password_confirm
    echo
    
    if [ "$password" != "$password_confirm" ]; then
        echo "Error: Passwords do not match!"
        return 1
    fi
    
    if [ -z "$password" ]; then
        echo "Error: Password cannot be empty!"
        return 1
    fi
    
    # Hash the password
    hashed_password=$(hash_password "$password")
    
    # Update password and revoke all refresh tokens for security
    sqlite3 "$DB_PATH" <<EOF
UPDATE users SET password = '$hashed_password' WHERE username = '$username';
DELETE FROM refresh_tokens WHERE user_id = (SELECT id FROM users WHERE username = '$username');
EOF
    
    if [ $? -eq 0 ]; then
        echo "✓ Password reset successfully for user '$username'."
        echo "  All active sessions have been invalidated."
    else
        echo "Error: Failed to reset password."
        return 1
    fi
}

# Function to create a new user
create_user() {
    read -p "Enter new username: " username
    
    # Check if username already exists
    user_exists=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM users WHERE username = '$username';")
    
    if [ "$user_exists" -gt 0 ]; then
        echo "Error: User '$username' already exists!"
        return 1
    fi
    
    # Get password
    read -sp "Enter password: " password
    echo
    read -sp "Confirm password: " password_confirm
    echo
    
    if [ "$password" != "$password_confirm" ]; then
        echo "Error: Passwords do not match!"
        return 1
    fi
    
    if [ -z "$password" ]; then
        echo "Error: Password cannot be empty!"
        return 1
    fi
    
    # Ask if admin
    read -p "Make this user an admin? (yes/no): " is_admin
    admin_flag=0
    if [ "$is_admin" = "yes" ]; then
        admin_flag=1
    fi
    
    # Hash the password
    hashed_password=$(hash_password "$password")
    
    # Create user
    sqlite3 "$DB_PATH" "INSERT INTO users (username, password, is_admin) VALUES ('$username', '$hashed_password', $admin_flag);"
    
    if [ $? -eq 0 ]; then
        echo "✓ User '$username' created successfully."
    else
        echo "Error: Failed to create user."
        return 1
    fi
}

# Function to toggle admin status
toggle_admin() {
    read -p "Enter username: " username
    
    # Check if user exists and get current admin status
    result=$(sqlite3 "$DB_PATH" "SELECT id, COALESCE(is_admin, 0) FROM users WHERE username = '$username';")
    
    if [ -z "$result" ]; then
        echo "Error: User '$username' not found!"
        return 1
    fi
    
    user_id=$(echo "$result" | cut -d'|' -f1)
    current_admin=$(echo "$result" | cut -d'|' -f2)
    
    # Toggle admin status
    new_admin=$((1 - current_admin))
    
    sqlite3 "$DB_PATH" "UPDATE users SET is_admin = $new_admin WHERE id = $user_id;"
    
    if [ $? -eq 0 ]; then
        if [ "$new_admin" -eq 1 ]; then
            echo "✓ User '$username' is now an admin."
        else
            echo "✓ User '$username' is no longer an admin."
        fi
    else
        echo "Error: Failed to update admin status."
        return 1
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "========================================"
    echo "  User Account Management"
    echo "========================================"
    echo "1. List all users"
    echo "2. Create new user"
    echo "3. Reset password"
    echo "4. Delete user"
    echo "5. Toggle admin status"
    echo "6. Exit"
    echo "========================================"
    read -p "Select an option (1-6): " choice
    
    case $choice in
        1)
            list_users
            ;;
        2)
            create_user
            ;;
        3)
            reset_password
            ;;
        4)
            delete_user
            ;;
        5)
            toggle_admin
            ;;
        6)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid option. Please try again."
            ;;
    esac
}

# Main loop
while true; do
    show_menu
done
