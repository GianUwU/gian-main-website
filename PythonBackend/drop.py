from fastapi import FastAPI, UploadFile, File, Query, Depends, HTTPException, Form, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import shutil
import os
from datetime import datetime
from contextlib import asynccontextmanager
import asyncio
import re

# Import centralized authentication system
import auth

# Cleanup task for expired files
async def cleanup_expired_files():
    """Background task to delete expired files"""
    while True:
        try:
            now = datetime.now().isoformat()
            files_c.execute(
                """SELECT id, filename FROM files WHERE expires_at IS NOT NULL AND expires_at <= ?""",
                (now,)
            )
            expired_files = files_c.fetchall()
            
            for file_id, filename in expired_files:
                # Delete file from filesystem
                file_path = os.path.join(UPLOAD_DIR, filename)
                file_deleted = False
                
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                        file_deleted = True
                        print(f"Deleted expired file from disk: {filename}")
                    except Exception as e:
                        print(f"Error deleting expired file {filename}: {e}")
                else:
                    print(f"Warning: Expired file not found on disk: {filename}")
                    file_deleted = True  # Consider it deleted if it doesn't exist
                
                # Delete from database (even if file doesn't exist on disk)
                if file_deleted or not os.path.exists(file_path):
                    files_c.execute("DELETE FROM files WHERE id = ?", (file_id,))
                    print(f"Deleted expired file from database: {file_id}")
            
            files_conn.commit()
        except Exception as e:
            print(f"Error in cleanup task: {e}")
        
        # Run every hour
        await asyncio.sleep(3600)

async def cleanup_auth_attempts():
    """Background task to clean up old authentication attempts"""
    while True:
        try:
            auth.cleanup_old_attempts()
        except Exception as e:
            print(f"Error in auth cleanup task: {e}")
        
        # Run every 15 minutes  
        await asyncio.sleep(900)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background tasks
    cleanup_task = asyncio.create_task(cleanup_expired_files())
    auth_cleanup_task = asyncio.create_task(cleanup_auth_attempts())
    
    yield
    
    # Cancel tasks on shutdown
    cleanup_task.cancel()
    auth_cleanup_task.cancel()
    try:
        await cleanup_task
        await auth_cleanup_task
    except asyncio.CancelledError:
        pass

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# FastAPI app with lifespan context manager
app = FastAPI(title="Gian Dropserver API", lifespan=lifespan)

# Add rate limiting error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Upload directory setup
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Validation functions
def validate_description(description: str) -> str:
    """Validate and sanitize file description"""
    if len(description) > 1000:
        raise HTTPException(status_code=400, detail="Description too long (max 1000 characters)")
    
    # Basic sanitization - remove potential HTML/script tags
    description = re.sub(r'<[^>]*>', '', description)
    return description.strip()

def validate_filename(filename: str) -> str:
    """Validate and sanitize filename"""
    if not filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")
    
    if len(filename) > 255:
        raise HTTPException(status_code=400, detail="Filename too long (max 255 characters)")
    
    # Remove dangerous characters and patterns
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = filename.strip('. ')
    
    return filename

def validate_expiration_days(days: int) -> int:
    """Validate expiration days"""
    if days is not None:
        if days < 0:
            raise HTTPException(status_code=400, detail="Expiration days cannot be negative")
        if days > 365:
            raise HTTPException(status_code=400, detail="Maximum expiration is 365 days")
        if days == 0:
            days = None
    
    return days

def check_upload_rate_limit(user_id: int):
    """Check if user has exceeded 20 uploads per hour limit"""
    from datetime import datetime, timedelta
    
    # Get uploads in the last hour
    one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
    
    files_c.execute(
        "SELECT COUNT(*) FROM files WHERE user_id = ? AND uploaded_at > ?",
        (user_id, one_hour_ago)
    )
    upload_count = files_c.fetchone()[0]
    
    if upload_count >= 20:
        raise HTTPException(
            status_code=429,
            detail="Upload rate limit exceeded. Maximum 20 uploads per hour."
        )

# Database setup
import sqlite3
files_conn = sqlite3.connect("drop_files.db", check_same_thread=False)
files_c = files_conn.cursor()

# Create files table for dropserver
files_c.execute("""
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    description TEXT,
    username TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    file_size INTEGER,
    file_type TEXT,
    is_private INTEGER DEFAULT 0,
    expires_at TEXT,
    batch_id TEXT,
    file_path TEXT
)
""")
files_conn.commit()

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://drop.gian.ink",
    "https://gian.ink",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Authentication endpoints (delegated to auth.py)
@app.post("/api/register", response_model=auth.User)
def register(user: auth.User, request: Request):
    return auth.register_user(user, request)

@app.post("/api/token", response_model=auth.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), request: Request = None):
    return auth.login_user(form_data, request)

@app.get("/api/user/info")
def get_user_info(current_user: dict = Depends(auth.get_current_user)):
    return current_user

@app.post("/api/change-password")
def change_password(password_change: auth.PasswordChange, request: Request, current_user: dict = Depends(auth.get_current_user)):
    return auth.change_user_password(password_change, request, current_user)

@app.post("/api/refresh")
def refresh_token(refresh_request: auth.RefreshTokenRequest, request: Request):
    return auth.refresh_access_token(refresh_request, request)

@app.post("/api/logout")
def logout(current_user: dict = Depends(auth.get_current_user), refresh_token: str = None):
    return auth.logout_user(current_user, refresh_token)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "drop"}

# File upload/management endpoints
@app.post("/api/upload")
@limiter.limit("20/hour")
async def upload_file(
    request: Request,
    files: list[UploadFile] = File(...),
    description: str = Form(""),
    is_private: bool = Form(False),
    expiration_days: int = Form(None),
    current_user: dict = Depends(auth.get_current_user)
):
    import uuid
    from datetime import datetime, timedelta
    import secrets
    
    # Check upload rate limit (20 uploads per hour per user)
    check_upload_rate_limit(current_user["id"])
    
    # Validate inputs
    description = validate_description(description)
    expiration_days = validate_expiration_days(expiration_days)
    
    # Generate batch ID if multiple files
    batch_id = None
    if len(files) > 1:
        batch_id = secrets.token_urlsafe(12)[:12]
    
    # Check storage limit (50GB)
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(UPLOAD_DIR):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if os.path.exists(filepath):
                total_size += os.path.getsize(filepath)
    
    size_gb = total_size / (1024 ** 3)
    if size_gb >= 50:
        raise HTTPException(status_code=507, detail="Server storage is full (50GB limit reached). Please contact administrator.")
    
    # Generate unique ID and filename (8 characters instead of 36)
    def generate_short_id(length=8):
        """Generate a short random ID using URL-safe characters"""
        return secrets.token_urlsafe(length)[:length]
    
    # Calculate expiration date if provided
    expires_at = None
    if expiration_days is not None and expiration_days > 0:
        expires_at = (datetime.now() + timedelta(days=expiration_days)).isoformat()
    
    # Process all files
    uploaded_files = []
    main_file_id = None
    max_file_size = 5 * 1024 * 1024 * 1024  # 5GB in bytes
    
    for file in files:
        # Validate filename
        original_filename = validate_filename(file.filename)
        
        # Ensure unique ID
        while True:
            unique_id = generate_short_id(8)
            files_c.execute("SELECT id FROM files WHERE id = ?", (unique_id,))
            if not files_c.fetchone():
                break
        
        if main_file_id is None:
            main_file_id = unique_id
        
        file_extension = os.path.splitext(original_filename)[1]
        unique_filename = f"{generate_short_id(12)}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file and check size limit
        file_size = 0
        
        with open(file_path, "wb") as buffer:
            content = await file.read()
            file_size = len(content)
            
            # Check if file exceeds 5GB limit
            if file_size > max_file_size:
                # Delete the file immediately
                if os.path.exists(file_path):
                    os.remove(file_path)
                # Clean up previously uploaded files in this batch
                for prev_file in uploaded_files:
                    prev_path = os.path.join(UPLOAD_DIR, prev_file["filename"])
                    if os.path.exists(prev_path):
                        os.remove(prev_path)
                raise HTTPException(status_code=413, detail=f"File '{original_filename}' too large. Maximum file size is 5GB.")
            
            buffer.write(content)
        
        # Store metadata in database
        files_c.execute(
            """INSERT INTO files (id, filename, original_filename, description, username, user_id, file_size, file_type, is_private, expires_at, batch_id, file_path)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (unique_id, unique_filename, original_filename, description, current_user["username"], current_user["id"], file_size, file.content_type, 1 if is_private else 0, expires_at, batch_id, original_filename)
        )
        
        uploaded_files.append({
            "id": unique_id,
            "filename": unique_filename,
            "original_filename": original_filename,
            "file_size": file_size,
            "file_type": file.content_type
        })
    
    files_conn.commit()
    
    # Get the full file info to return (first file)
    files_c.execute(
        """SELECT id, filename, original_filename, description, username, user_id, uploaded_at, file_size, file_type, is_private, expires_at, batch_id
           FROM files WHERE id = ?""",
        (main_file_id,)
    )
    file_info = files_c.fetchone()
    
    return {
        "status": "ok",
        "file": {
            "id": file_info[0],
            "filename": file_info[1],
            "original_filename": file_info[2],
            "description": file_info[3],
            "username": file_info[4],
            "user_id": file_info[5],
            "uploaded_at": file_info[6],
            "file_size": file_info[7],
            "file_type": file_info[8],
            "is_private": bool(file_info[9]),
            "expires_at": file_info[10],
            "batch_id": file_info[11],
            "total_files": len(uploaded_files)
        }
    }

@app.get("/api/files")
async def list_files(offset: int = Query(0, ge=0), limit: int = Query(15, gt=0)):
    """
    Return files with metadata for lazy loading.
    Only returns public files - private files are not listed.
    For batches, only show the first file.
    """
    files_c.execute(
        """SELECT id, filename, original_filename, description, username, user_id, uploaded_at, file_size, file_type, is_private, expires_at, batch_id
           FROM files 
           WHERE is_private = 0
           ORDER BY uploaded_at DESC 
           LIMIT ? OFFSET ?""",
        (limit, offset)
    )
    files = files_c.fetchall()
    
    # Filter to show only first file of each batch
    seen_batches = set()
    filtered_files = []
    
    for f in files:
        batch_id = f[11]
        if batch_id and batch_id in seen_batches:
            continue
        if batch_id:
            seen_batches.add(batch_id)
            # Get total count for batch
            files_c.execute("SELECT COUNT(*), SUM(file_size) FROM files WHERE batch_id = ?", (batch_id,))
            batch_info = files_c.fetchone()
            total_files = batch_info[0] if batch_info else 1
            total_size = batch_info[1] if batch_info else f[7]
        else:
            total_files = None
            total_size = None
        
        filtered_files.append({
            "id": f[0],
            "filename": f[1],
            "original_filename": f[2],
            "description": f[3],
            "username": f[4],
            "user_id": f[5],
            "uploaded_at": f[6],
            "file_size": f[7],
            "file_type": f[8],
            "is_private": bool(f[9]),
            "expires_at": f[10],
            "batch_id": batch_id,
            "total_files": total_files,
            "total_size": total_size
        })
    
    return JSONResponse(content=filtered_files)

@app.get("/api/files/{file_id}")
async def get_file_details(file_id: str):
    """
    Get details of a specific file by ID (UUID).
    Private files are accessible via direct link.
    If file is part of a batch, return all files in the batch.
    """
    files_c.execute(
        """SELECT id, filename, original_filename, description, username, user_id, uploaded_at, file_size, file_type, is_private, expires_at, batch_id, file_path
           FROM files WHERE id = ?""",
        (file_id,)
    )
    file_info = files_c.fetchone()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    batch_id = file_info[11]
    
    # If part of a batch, return all files in the batch
    if batch_id:
        files_c.execute(
            """SELECT id, filename, original_filename, description, username, user_id, uploaded_at, file_size, file_type, is_private, expires_at, batch_id, file_path
               FROM files WHERE batch_id = ?
               ORDER BY file_path""",
            (batch_id,)
        )
        batch_files = files_c.fetchall()
        
        return {
            "is_batch": True,
            "batch_id": batch_id,
            "files": [
                {
                    "id": f[0],
                    "filename": f[1],
                    "original_filename": f[2],
                    "description": f[3],
                    "username": f[4],
                    "user_id": f[5],
                    "uploaded_at": f[6],
                    "file_size": f[7],
                    "file_type": f[8],
                    "is_private": bool(f[9]),
                    "expires_at": f[10],
                    "batch_id": f[11],
                    "file_path": f[12]
                }
                for f in batch_files
            ]
        }
    
    # Single file
    return {
        "id": file_info[0],
        "filename": file_info[1],
        "original_filename": file_info[2],
        "description": file_info[3],
        "username": file_info[4],
        "user_id": file_info[5],
        "uploaded_at": file_info[6],
        "file_size": file_info[7],
        "file_type": file_info[8],
        "is_private": bool(file_info[9]),
        "expires_at": file_info[10],
        "batch_id": None,
        "file_path": file_info[12]
    }

@app.get("/api/files/{file_id}/now")
async def download_file_immediately(file_id: str):
    """
    Immediately download a file by ID.
    Access via /api/files/{file_id}/now to trigger instant download.
    """
    files_c.execute(
        """SELECT filename, original_filename FROM files WHERE id = ?""",
        (file_id,)
    )
    file_info = files_c.fetchone()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    filename = file_info[0]
    original_filename = file_info[1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    return FileResponse(
        path=file_path,
        filename=original_filename,
        media_type='application/octet-stream'
    )

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: str, current_user: dict = Depends(auth.get_current_user)):
    """
    Delete a file. Users can only delete their own files (or admins can delete any).
    If the file is part of a batch, all files in the batch will be deleted.
    """
    # Check if file exists and belongs to user
    files_c.execute("SELECT filename, user_id, batch_id FROM files WHERE id = ?", (file_id,))
    file_info = files_c.fetchone()
    
    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")
    
    filename, file_user_id, batch_id = file_info
    
    # Check permissions: must be owner or admin
    if file_user_id != current_user["id"] and not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="You can only delete your own files")
    
    # Get all files to delete (either single file or entire batch)
    if batch_id:
        # Delete all files in the batch
        files_c.execute("SELECT id, filename FROM files WHERE batch_id = ?", (batch_id,))
        files_to_delete = files_c.fetchall()
    else:
        # Delete single file
        files_to_delete = [(file_id, filename)]
    
    # Delete files from filesystem
    deleted_count = 0
    for fid, fname in files_to_delete:
        file_path = os.path.join(UPLOAD_DIR, fname)
        
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                print(f"Successfully deleted file from disk: {fname}")
                deleted_count += 1
            except Exception as e:
                print(f"Error deleting file from disk: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to delete file from storage: {e}")
        else:
            print(f"Warning: File not found on disk: {fname}")
            deleted_count += 1  # Count as deleted if it doesn't exist
    
    # Delete from database
    if batch_id:
        files_c.execute("DELETE FROM files WHERE batch_id = ?", (batch_id,))
        print(f"Successfully deleted batch from database: {batch_id} ({deleted_count} files)")
    else:
        files_c.execute("DELETE FROM files WHERE id = ?", (file_id,))
        print(f"Successfully deleted file from database: {file_id}")
    
    files_conn.commit()
    
    message = f"{deleted_count} file{'s' if deleted_count > 1 else ''} deleted successfully"
    return {"status": "ok", "message": message}

@app.get("/api/my-files")
async def list_my_files(
    offset: int = Query(0, ge=0), 
    limit: int = Query(15, gt=0),
    current_user: dict = Depends(auth.get_current_user)
):
    """
    Return all files uploaded by the current user (including private ones).
    For batches, only show the first file.
    """
    files_c.execute(
        """SELECT id, filename, original_filename, description, username, user_id, uploaded_at, file_size, file_type, is_private, expires_at, batch_id
           FROM files 
           WHERE user_id = ?
           ORDER BY uploaded_at DESC 
           LIMIT ? OFFSET ?""",
        (current_user["id"], limit, offset)
    )
    files = files_c.fetchall()
    
    # Filter to show only first file of each batch
    seen_batches = set()
    filtered_files = []
    
    for f in files:
        batch_id = f[11]
        if batch_id and batch_id in seen_batches:
            continue
        if batch_id:
            seen_batches.add(batch_id)
            # Get total count for batch
            files_c.execute("SELECT COUNT(*), SUM(file_size) FROM files WHERE batch_id = ?", (batch_id,))
            batch_info = files_c.fetchone()
            total_files = batch_info[0] if batch_info else 1
            total_size = batch_info[1] if batch_info else f[7]
        else:
            total_files = None
            total_size = None
        
        filtered_files.append({
            "id": f[0],
            "filename": f[1],
            "original_filename": f[2],
            "description": f[3],
            "username": f[4],
            "user_id": f[5],
            "uploaded_at": f[6],
            "file_size": f[7],
            "file_type": f[8],
            "is_private": bool(f[9]),
            "expires_at": f[10],
            "batch_id": batch_id,
            "total_files": total_files,
            "total_size": total_size
        })
    
    return JSONResponse(content=filtered_files)

@app.get("/api/all-files")
async def list_all_files(
    offset: int = Query(0, ge=0), 
    limit: int = Query(15, gt=0),
    current_user: dict = Depends(auth.get_current_user)
):
    """
    Return ALL files including private ones (admin only).
    For batches, only show the first file.
    """
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    files_c.execute(
        """SELECT id, filename, original_filename, description, username, user_id, uploaded_at, file_size, file_type, is_private, expires_at, batch_id
           FROM files 
           ORDER BY uploaded_at DESC 
           LIMIT ? OFFSET ?""",
        (limit, offset)
    )
    files = files_c.fetchall()
    
    # Filter to show only first file of each batch
    seen_batches = set()
    filtered_files = []
    
    for f in files:
        batch_id = f[11]
        if batch_id and batch_id in seen_batches:
            continue
        if batch_id:
            seen_batches.add(batch_id)
            # Get total count for batch
            files_c.execute("SELECT COUNT(*), SUM(file_size) FROM files WHERE batch_id = ?", (batch_id,))
            batch_info = files_c.fetchone()
            total_files = batch_info[0] if batch_info else 1
            total_size = batch_info[1] if batch_info else f[7]
        else:
            total_files = None
            total_size = None
        
        filtered_files.append({
            "id": f[0],
            "filename": f[1],
            "original_filename": f[2],
            "description": f[3],
            "username": f[4],
            "user_id": f[5],
            "uploaded_at": f[6],
            "file_size": f[7],
            "file_type": f[8],
            "is_private": bool(f[9]),
            "expires_at": f[10],
            "batch_id": batch_id,
            "total_files": total_files,
            "total_size": total_size
        })
    
    return JSONResponse(content=filtered_files)

@app.get("/api/storage-info")
async def get_storage_info():
    """
    Get storage usage information.
    """
    import shutil
    
    # Calculate total size of uploads directory
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(UPLOAD_DIR):
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            if os.path.exists(filepath):
                total_size += os.path.getsize(filepath)
    
    # Convert to GB
    size_gb = total_size / (1024 ** 3)
    max_size_gb = 50
    percentage = (size_gb / max_size_gb) * 100
    
    return {
        "used_gb": round(size_gb, 2),
        "max_gb": max_size_gb,
        "percentage": round(percentage, 1),
        "is_full": size_gb >= max_size_gb
    }