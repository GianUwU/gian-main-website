#!/bin/bash

# Restore script for gian-webserver project
# Usage: ./restore.sh [backup_name] [-to destination_path] [-list] [-info backup_name]
# backup_name: Name of the backup to restore (without .tar.gz extension)
# -to destination_path: Restore to a different location (default overwrites current project)
# -list: List all available backups
# -info backup_name: Show information about a specific backup

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
BACKUP_NAME=""
DESTINATION_PATH=""
LIST_BACKUPS=false
SHOW_INFO=false
INFO_BACKUP=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -list|--list)
            LIST_BACKUPS=true
            shift
            ;;
        -info|--info)
            SHOW_INFO=true
            INFO_BACKUP="$2"
            shift 2
            ;;
        -to|--to)
            DESTINATION_PATH="$2"
            shift 2
            ;;
        *)
            BACKUP_NAME="$1"
            shift
            ;;
    esac
done

# Function to list all backups
list_backups() {
    echo -e "${BLUE}Available backups:${NC}"
    if [[ ! -f "$BACKUP_INFO_FILE" ]]; then
        echo -e "${RED}No backup history found.${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Type        | Date & Time         | Backup Name${NC}"
    echo "------------|---------------------|-----------------------------"
    
    while IFS='|' read -r timestamp type path base; do
        backup_name=$(basename "$path" .tar.gz)
        backup_size=""
        if [[ -f "$path" ]]; then
            backup_size=$(du -h "$path" 2>/dev/null | cut -f1)
        else
            backup_size="MISSING"
        fi
        printf "%-11s | %-19s | %-20s (%s)\n" "$type" "$timestamp" "$backup_name" "$backup_size"
    done < "$BACKUP_INFO_FILE"
}

# Function to show backup info
show_backup_info() {
    local backup_name="$1"
    local backup_path="$BACKUP_BASE_DIR/${backup_name}.tar.gz"
    
    if [[ ! -f "$backup_path" ]]; then
        echo -e "${RED}Backup file not found: $backup_path${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Backup Information: $backup_name${NC}"
    echo -e "${YELLOW}Path:${NC} $backup_path"
    echo -e "${YELLOW}Size:${NC} $(du -h "$backup_path" | cut -f1)"
    echo -e "${YELLOW}Created:${NC} $(stat -c '%y' "$backup_path")"
    
    # Find backup info from history
    if [[ -f "$BACKUP_INFO_FILE" ]]; then
        local backup_info=$(grep "$backup_path" "$BACKUP_INFO_FILE" 2>/dev/null || true)
        if [[ -n "$backup_info" ]]; then
            IFS='|' read -r timestamp type path base <<< "$backup_info"
            echo -e "${YELLOW}Type:${NC} $type"
            echo -e "${YELLOW}Recorded:${NC} $timestamp"
            if [[ "$type" == "INCREMENTAL" && -n "$base" && "$base" != "N/A" ]]; then
                echo -e "${YELLOW}Base backup:${NC} $(basename "$base" .tar.gz)"
            fi
        fi
    fi
    
    echo -e "\n${YELLOW}Contents preview:${NC}"
    tar tzf "$backup_path" | head -20
    local total_files=$(tar tzf "$backup_path" | wc -l)
    if [[ $total_files -gt 20 ]]; then
        echo "... and $((total_files - 20)) more files"
    fi
}

# Function to backup current project before restore
backup_current() {
    if [[ -d "$PROJECT_DIR" ]]; then
        local backup_name="pre_restore_$(date '+%Y%m%d_%H%M%S')"
        local backup_path="$BACKUP_BASE_DIR/${backup_name}.tar.gz"
        
        echo -e "${YELLOW}Creating backup of current project before restore...${NC}"
        mkdir -p "$BACKUP_BASE_DIR"
        
        tar czf "$backup_path" \
            --exclude='node_modules' \
            --exclude='dist' \
            --exclude='build' \
            --exclude='.git' \
            --exclude='*.log' \
            --exclude='__pycache__' \
            --exclude='.pytest_cache' \
            --exclude='*.pyc' \
            --exclude='.env.local' \
            --exclude='.env.*.local' \
            --exclude='PythonBackend/uploads/*' \
            -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"
        
        echo "$(date '+%Y-%m-%d %H:%M:%S')|PRE_RESTORE|$backup_path|N/A" >> "$BACKUP_INFO_FILE"
        echo -e "${GREEN}Current project backed up as: $backup_name${NC}"
    fi
}

# Function to restore backup
restore_backup() {
    local backup_name="$1"
    local destination="$2"
    local backup_path="$BACKUP_BASE_DIR/${backup_name}.tar.gz"
    
    if [[ ! -f "$backup_path" ]]; then
        echo -e "${RED}Backup file not found: $backup_path${NC}"
        return 1
    fi
    
    echo -e "${BLUE}Restoring backup: $backup_name${NC}"
    echo -e "${YELLOW}From: $backup_path${NC}"
    echo -e "${YELLOW}To: $destination${NC}"
    
    # Ask for confirmation
    read -p "Are you sure you want to restore this backup? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Restore cancelled.${NC}"
        return 0
    fi
    
    # Create destination directory if it doesn't exist
    mkdir -p "$(dirname "$destination")"
    
    # Remove existing destination if it exists
    if [[ -d "$destination" ]]; then
        rm -rf "$destination"
    fi
    
    # Extract backup
    echo -e "${YELLOW}Extracting backup...${NC}"
    tar xzf "$backup_path" -C "$(dirname "$destination")"
    
    # If extracted directory name differs from expected, rename it
    local extracted_dir="$(dirname "$destination")/$(tar tzf "$backup_path" | head -1 | cut -d'/' -f1)"
    if [[ "$extracted_dir" != "$destination" ]]; then
        mv "$extracted_dir" "$destination"
    fi
    
    echo -e "${GREEN}Restore completed successfully!${NC}"
    echo -e "${GREEN}Project restored to: $destination${NC}"
    
    # Show post-restore instructions
    echo -e "\n${BLUE}Post-restore steps:${NC}"
    echo "1. Navigate to the restored project: cd $destination"
    echo "2. Install dependencies if needed:"
    echo "   - Frontend (main-app): cd main-app && npm install"
    echo "   - Frontend (finance-app): cd finance-app && npm install"
    echo "   - Backend: cd PythonBackend && pip install -r requirements.txt"
    echo "3. Update any environment-specific configurations"
}

# Main logic
if [[ "$LIST_BACKUPS" == true ]]; then
    list_backups
    exit 0
fi

if [[ "$SHOW_INFO" == true ]]; then
    if [[ -z "$INFO_BACKUP" ]]; then
        echo -e "${RED}Error: Please specify a backup name with -info${NC}"
        exit 1
    fi
    show_backup_info "$INFO_BACKUP"
    exit 0
fi

if [[ -z "$BACKUP_NAME" ]]; then
    echo -e "${YELLOW}Usage: $0 [backup_name] [-to destination_path] [-list] [-info backup_name]${NC}"
    echo -e "\nExamples:"
    echo "  $0 -list                           # List all backups"
    echo "  $0 -info full_20240123_143022      # Show backup information"
    echo "  $0 full_20240123_143022            # Restore to original location"
    echo "  $0 inc_20240123_150000 -to /tmp/restore  # Restore to different location"
    echo -e "\n${YELLOW}Available backups:${NC}"
    list_backups
    exit 1
fi

# Set default destination
if [[ -z "$DESTINATION_PATH" ]]; then
    DESTINATION_PATH="$PROJECT_DIR"
    # Backup current project before overwriting
    backup_current
fi

# Perform restore
restore_backup "$BACKUP_NAME" "$DESTINATION_PATH"