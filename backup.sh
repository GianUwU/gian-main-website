#!/bin/bash

# Backup script for gian-webserver project
# Usage: ./backup.sh [-full] [backup_name]
# -full: Create a full backup (default is incremental)
# backup_name: Optional name for the backup (default uses timestamp)

set -e

# Configuration
PROJECT_DIR="/home/gian/gian-webserver"
BACKUP_BASE_DIR="$HOME/backups/gian-webserver"
BACKUP_INFO_FILE="$BACKUP_BASE_DIR/backup_info.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
FULL_BACKUP=false
BACKUP_NAME=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -full|--full)
            FULL_BACKUP=true
            shift
            ;;
        *)
            BACKUP_NAME="$1"
            shift
            ;;
    esac
done

# Generate backup name if not provided
if [[ -z "$BACKUP_NAME" ]]; then
    TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
    if [[ "$FULL_BACKUP" == true ]]; then
        BACKUP_NAME="full_$TIMESTAMP"
    else
        BACKUP_NAME="inc_$TIMESTAMP"
    fi
fi

# Create backup directory structure
mkdir -p "$BACKUP_BASE_DIR"

# Function to log backup info
log_backup_info() {
    local backup_type="$1"
    local backup_path="$2"
    local base_backup="$3"
    
    echo "$(date '+%Y-%m-%d %H:%M:%S')|$backup_type|$backup_path|$base_backup" >> "$BACKUP_INFO_FILE"
}

# Function to find the latest full backup
find_latest_full_backup() {
    if [[ ! -f "$BACKUP_INFO_FILE" ]]; then
        return 1
    fi
    
    grep "FULL" "$BACKUP_INFO_FILE" | tail -n 1 | cut -d'|' -f3
}

# Function to create backup
create_backup() {
    local backup_type="$1"
    local backup_path="$2"
    local base_backup="$3"
    
    echo -e "${BLUE}Creating $backup_type backup: $BACKUP_NAME${NC}"
    echo -e "${YELLOW}Backup location: $backup_path${NC}"
    
    # Exclude patterns
    local exclude_args=(
        --exclude='node_modules'
        --exclude='dist'
        --exclude='build'
        --exclude='.git'
        --exclude='*.log'
        --exclude='__pycache__'
        --exclude='.pytest_cache'
        --exclude='*.pyc'
        --exclude='.env.local'
        --exclude='.env.*.local'
        --exclude='PythonBackend/uploads/*'
    )
    
    if [[ "$backup_type" == "FULL" ]]; then
        # Full backup
        tar czf "$backup_path" "${exclude_args[@]}" -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"
    else
        # Incremental backup
        if [[ -z "$base_backup" || ! -f "$base_backup" ]]; then
            echo -e "${RED}Error: No base backup found. Creating full backup instead.${NC}"
            BACKUP_NAME="full_$(date '+%Y%m%d_%H%M%S')"
            backup_path="$BACKUP_BASE_DIR/${BACKUP_NAME}.tar.gz"
            tar czf "$backup_path" "${exclude_args[@]}" -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"
            log_backup_info "FULL" "$backup_path" "N/A"
            return 0
        fi
        
        # Create incremental backup using rsync and tar
        temp_dir=$(mktemp -d)
        temp_backup_dir="$temp_dir/$(basename "$PROJECT_DIR")"
        
        # Extract base backup to temp directory
        echo -e "${YELLOW}Extracting base backup for comparison...${NC}"
        tar xzf "$base_backup" -C "$temp_dir"
        
        # Use rsync to create incremental changes
        echo -e "${YELLOW}Computing incremental changes...${NC}"
        rsync -av --delete --exclude-from=<(printf '%s\n' "${exclude_args[@]/#--exclude=/}") \
            "$PROJECT_DIR/" "$temp_backup_dir/"
        
        # Create incremental backup
        tar czf "$backup_path" -C "$temp_dir" "$(basename "$PROJECT_DIR")"
        
        # Clean up
        rm -rf "$temp_dir"
    fi
    
    log_backup_info "$backup_type" "$backup_path" "$base_backup"
    
    # Get backup size
    backup_size=$(du -h "$backup_path" | cut -f1)
    echo -e "${GREEN}Backup completed successfully!${NC}"
    echo -e "${GREEN}Size: $backup_size${NC}"
    echo -e "${GREEN}Location: $backup_path${NC}"
}

# Main backup logic
if [[ "$FULL_BACKUP" == true ]]; then
    # Full backup
    backup_path="$BACKUP_BASE_DIR/${BACKUP_NAME}.tar.gz"
    create_backup "FULL" "$backup_path" ""
else
    # Incremental backup
    latest_full=$(find_latest_full_backup) || true
    if [[ -z "$latest_full" ]]; then
        echo -e "${YELLOW}No previous full backup found. Creating full backup instead.${NC}"
        BACKUP_NAME="full_$(date '+%Y%m%d_%H%M%S')"
        backup_path="$BACKUP_BASE_DIR/${BACKUP_NAME}.tar.gz"
        create_backup "FULL" "$backup_path" ""
    else
        backup_path="$BACKUP_BASE_DIR/${BACKUP_NAME}.tar.gz"
        create_backup "INCREMENTAL" "$backup_path" "$latest_full"
    fi
fi

echo -e "\n${BLUE}Backup History (last 10):${NC}"
if [[ -f "$BACKUP_INFO_FILE" ]]; then
    tail -n 10 "$BACKUP_INFO_FILE" | while IFS='|' read -r timestamp type path base; do
        echo -e "${GREEN}$timestamp${NC} - ${YELLOW}$type${NC} - $(basename "$path" .tar.gz)"
    done
else
    echo "No backup history found."
fi