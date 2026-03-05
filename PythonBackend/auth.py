"""
Centralized Authentication System
Handles user registration, login, token management, and admin operations.
Can be shared across all applications on the website.
"""
from fastapi import HTTPException, Depends, Request, Cookie
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import sqlite3
import hashlib
import jwt
import re

SECRET_KEY = "26238ff6610782fd4a68ffcf0d268d00dc91a4f55ac507425c40d2e9fa2ec426"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60  # Short-lived access token
REFRESH_TOKEN_EXPIRE_DAYS = 30  # Long-lived refresh token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# Separate authentication database
auth_conn = sqlite3.connect("auth.db", check_same_thread=False)
auth_c = auth_conn.cursor()

# Create users table in auth database
auth_c.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
""")

# Create refresh tokens table for token management
auth_c.execute("""
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
)
""")

# Create rate limiting table for tracking authentication attempts
auth_c.execute("""
CREATE TABLE IF NOT EXISTS auth_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    username TEXT,
    attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0
)
""")
auth_conn.commit()

# Models
class User(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class AdminPasswordReset(BaseModel):
    user_id: int
    new_password: str

class AdminStatusUpdate(BaseModel):
    user_id: int
    is_admin: bool

# Helper functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    """Create a long-lived refresh token and store it in the database"""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    token_data = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh"
    }
    token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    # Store refresh token in database
    auth_c.execute(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user_id, token, expire.isoformat())
    )
    auth_conn.commit()
    
    return token

def verify_refresh_token(token: str) -> dict:
    """Verify refresh token and return user info"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = int(payload.get("sub"))
        
        # Check if token exists in database and hasn't been revoked
        auth_c.execute(
            "SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?",
            (token,)
        )
        db_token = auth_c.fetchone()
        
        if not db_token:
            raise HTTPException(status_code=401, detail="Token has been revoked")
        
        # Get user info
        auth_c.execute("SELECT id, username, COALESCE(is_admin, 0) FROM users WHERE id = ?", (user_id,))
        user = auth_c.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {"id": user[0], "username": user[1], "is_admin": bool(user[2])}
    
    except jwt.ExpiredSignatureError:
        # Clean up expired token
        try:
            auth_c.execute("DELETE FROM refresh_tokens WHERE token = ?", (token,))
            auth_conn.commit()
        except:
            pass
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

def get_current_user(
    authToken: Optional[str] = Cookie(None),
    token: Optional[str] = Depends(oauth2_scheme)
):
    """
    Validate JWT token from cookie or Authorization header and return current user information.
    Checks cookie first (authToken), then falls back to Authorization header.
    This function can be used as a dependency in any FastAPI app.
    """
    # Try cookie first, then Authorization header
    jwt_token = authToken or token
    
    if not jwt_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(jwt_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        
        if not username:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        auth_c.execute("SELECT id, username, COALESCE(is_admin, 0) FROM users WHERE username = ?", (username,))
        user = auth_c.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return {"id": user[0], "username": user[1], "is_admin": bool(user[2])}
    
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

def get_admin_user(current_user: dict = Depends(get_current_user)):
    """
    Ensure the current user has admin privileges.
    This function can be used as a dependency in any FastAPI app.
    """
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Rate limiting functions
def check_rate_limit(ip_address: str, endpoint: str, limit: int, window_minutes: int, username: str = None):
    """
    Check if IP has exceeded rate limit for a specific endpoint.
    
    Args:
        ip_address: Client IP address
        endpoint: The endpoint being accessed (e.g., 'login', 'register')
        limit: Maximum number of attempts allowed
        window_minutes: Time window in minutes
        username: Optional username for more specific tracking
    """
    from datetime import datetime, timedelta
    
    # Calculate time threshold
    threshold = (datetime.now() - timedelta(minutes=window_minutes)).isoformat()
    
    # Count recent attempts from this IP for this endpoint
    if username:
        auth_c.execute(
            "SELECT COUNT(*) FROM auth_attempts WHERE ip_address = ? AND endpoint = ? AND username = ? AND attempted_at > ?",
            (ip_address, endpoint, username, threshold)
        )
    else:
        auth_c.execute(
            "SELECT COUNT(*) FROM auth_attempts WHERE ip_address = ? AND endpoint = ? AND attempted_at > ?",
            (ip_address, endpoint, threshold)
        )
    
    count = auth_c.fetchone()[0]
    
    if count >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {limit} attempts per {window_minutes} minutes. Please try again later."
        )

def log_auth_attempt(ip_address: str, endpoint: str, username: str = None, success: bool = False):
    """Log an authentication attempt"""
    auth_c.execute(
        "INSERT INTO auth_attempts (ip_address, endpoint, username, success) VALUES (?, ?, ?, ?)",
        (ip_address, endpoint, username, 1 if success else 0)
    )
    auth_conn.commit()

def cleanup_old_attempts():
    """Clean up authentication attempts older than 24 hours"""
    from datetime import datetime, timedelta
    
    threshold = (datetime.now() - timedelta(hours=24)).isoformat()
    auth_c.execute("DELETE FROM auth_attempts WHERE attempted_at < ?", (threshold,))
    auth_conn.commit()

# Input validation functions
def validate_username(username: str) -> str:
    """Validate username"""
    
    if not username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")
    
    # Remove leading/trailing whitespace
    username = username.strip()
    
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    
    if len(username) > 50:
        raise HTTPException(status_code=400, detail="Username must be 50 characters or less")
    
    # Allow alphanumeric, underscore, hyphen, and dot
    if not re.match(r'^[a-zA-Z0-9_.-]+$', username):
        raise HTTPException(status_code=400, detail="Username can only contain letters, numbers, underscore, hyphen, and dot")
    
    return username

def get_client_ip(request: Request) -> str:
    """Extract client IP address from request"""
    # Check for forwarded IP (if behind proxy)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to direct client IP
    return request.client.host if request.client else "unknown"

# Authentication endpoints
def register_user(user: User, request: Request):
    """Register a new user - Rate limited to 5 registrations per hour per IP"""
    ip_address = get_client_ip(request)
    
    try:
        # Rate limit: 5 registrations per hour per IP
        check_rate_limit(ip_address, "register", limit=5, window_minutes=60)
        
        # Validate inputs
        username = validate_username(user.username)
        
        if not user.password:
            raise HTTPException(status_code=400, detail="Password cannot be empty")
        
        hashed_pw = hash_password(user.password)
        auth_c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, hashed_pw))
        auth_conn.commit()
        
        # Log successful registration
        log_auth_attempt(ip_address, "register", username, success=True)
        
        print(f"✅ Registered: {username}")
        return user
    except sqlite3.IntegrityError:
        log_auth_attempt(ip_address, "register", user.username, success=False)
        raise HTTPException(status_code=400, detail="Username already exists")
    except HTTPException:
        raise
    except Exception as e:
        log_auth_attempt(ip_address, "register", user.username, success=False)
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def login_user(form_data: OAuth2PasswordRequestForm, request: Request):
    """Authenticate user and return JWT tokens (access + refresh) - Rate limited to prevent brute force"""
    ip_address = get_client_ip(request)
    
    try:
        # Rate limit: 10 login attempts per 15 minutes per IP
        check_rate_limit(ip_address, "login", limit=10, window_minutes=15)
        
        # Additional rate limit: 5 failed attempts per username per 15 minutes
        check_rate_limit(ip_address, "login", limit=5, window_minutes=15, username=form_data.username)
        
        auth_c.execute("SELECT id, password FROM users WHERE username = ?", (form_data.username,))
        user = auth_c.fetchone()
        
        if not user or hash_password(form_data.password) != user[1]:
            log_auth_attempt(ip_address, "login", form_data.username, success=False)
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        user_id = user[0]
        
        # Create both access and refresh tokens
        access_token = create_access_token({"sub": form_data.username})
        refresh_token = create_refresh_token(user_id)
        
        # Log successful login
        log_auth_attempt(ip_address, "login", form_data.username, success=True)
        
        print(f"✅ Login: {form_data.username}")
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    except HTTPException:
        raise
    except Exception as e:
        log_auth_attempt(ip_address, "login", form_data.username, success=False)
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def get_user_info(current_user: dict):
    """Get current user information"""
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "is_admin": current_user.get("is_admin", False)
    }

def refresh_access_token(refresh_request: RefreshTokenRequest, request: Request):
    """Use refresh token to get a new access token - Rate limited to prevent token abuse"""
    ip_address = get_client_ip(request)
    
    try:
        # Rate limit: 30 refresh attempts per 15 minutes per IP
        check_rate_limit(ip_address, "refresh", limit=30, window_minutes=15)
        
        user = verify_refresh_token(refresh_request.refresh_token)
        
        # Create new access token
        access_token = create_access_token({"sub": user["username"]})
        
        # Log successful refresh
        log_auth_attempt(ip_address, "refresh", user["username"], success=True)
        
        print(f"✅ Token refreshed: {user['username']}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    except HTTPException:
        log_auth_attempt(ip_address, "refresh", success=False)
        raise
    except Exception as e:
        log_auth_attempt(ip_address, "refresh", success=False)
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def logout_user(current_user: dict, refresh_token: str = None):
    """Logout user and revoke refresh token"""
    try:
        # If refresh token provided, delete it specifically
        if refresh_token:
            auth_c.execute("DELETE FROM refresh_tokens WHERE token = ?", (refresh_token,))
        else:
            # Otherwise, delete all refresh tokens for this user
            auth_c.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (current_user["id"],))
        
        auth_conn.commit()
        print(f"✅ Logout: {current_user['username']}")
        return {"message": "Logged out successfully"}
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def change_user_password(password_change: PasswordChange, current_user: dict, request: Request):
    """Change current user's password - Rate limited to prevent abuse"""
    ip_address = get_client_ip(request)
    
    try:
        # Rate limit: 5 password change attempts per hour per user
        check_rate_limit(ip_address, "change_password", limit=5, window_minutes=60, username=current_user["username"])
        
        auth_c.execute("SELECT password FROM users WHERE id = ?", (current_user["id"],))
        user = auth_c.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if hash_password(password_change.current_password) != user[0]:
            log_auth_attempt(ip_address, "change_password", current_user["username"], success=False)
            raise HTTPException(status_code=401, detail="Incorrect current password")
        
        hashed_new = hash_password(password_change.new_password)
        auth_c.execute("UPDATE users SET password = ? WHERE id = ?", (hashed_new, current_user["id"]))
        auth_conn.commit()
        
        # Revoke all refresh tokens when password changes (for security)
        auth_c.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (current_user["id"],))
        auth_conn.commit()
        
        # Log successful password change
        log_auth_attempt(ip_address, "change_password", current_user["username"], success=True)
        
        print(f"✅ Password changed: {current_user['username']}")
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        log_auth_attempt(ip_address, "change_password", current_user["username"], success=False)
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Admin functions
def get_all_users(admin_user: dict):
    """Get all users (admin only)"""
    try:
        auth_c.execute("SELECT id, username, COALESCE(is_admin, 0), created_at FROM users ORDER BY username")
        users = auth_c.fetchall()
        
        return [
            {
                "id": user[0],
                "username": user[1],
                "is_admin": bool(user[2]),
                "created_at": user[3]
            }
            for user in users
        ]
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def admin_reset_user_password(reset: AdminPasswordReset, admin_user: dict, request: Request):
    """Admin: Reset a user's password - Rate limited to prevent abuse"""
    ip_address = get_client_ip(request)
    
    try:
        # Rate limit: 20 admin password resets per hour
        check_rate_limit(ip_address, "admin_reset_password", limit=20, window_minutes=60, username=admin_user["username"])
        
        auth_c.execute("SELECT username FROM users WHERE id = ?", (reset.user_id,))
        user = auth_c.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        hashed_new = hash_password(reset.new_password)
        auth_c.execute("UPDATE users SET password = ? WHERE id = ?", (hashed_new, reset.user_id))
        auth_conn.commit()
        
        # Log admin action
        log_auth_attempt(ip_address, "admin_reset_password", f"admin:{admin_user['username']}->user:{user[0]}", success=True)
        
        print(f"✅ Admin {admin_user['username']} reset password for user: {user[0]}")
        return {"message": f"Password reset successfully for user {user[0]}"}
    except HTTPException:
        raise
    except Exception as e:
        log_auth_attempt(ip_address, "admin_reset_password", f"admin:{admin_user['username']}", success=False)
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def admin_update_user_admin_status(status_update: AdminStatusUpdate, admin_user: dict):
    """Admin: Grant or revoke admin status"""
    try:
        auth_c.execute("SELECT username FROM users WHERE id = ?", (status_update.user_id,))
        user = auth_c.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        auth_c.execute("UPDATE users SET is_admin = ? WHERE id = ?", (1 if status_update.is_admin else 0, status_update.user_id))
        auth_conn.commit()
        
        action = "granted" if status_update.is_admin else "revoked"
        print(f"✅ Admin {admin_user['username']} {action} admin status for user: {user[0]}")
        return {"message": f"Admin status {action} for user {user[0]}"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def admin_delete_user(user_id: int, admin_user: dict):
    """Admin: Delete a user (note: app-specific data must be handled by each app)"""
    try:
        auth_c.execute("SELECT username FROM users WHERE id = ?", (user_id,))
        user = auth_c.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        auth_c.execute("DELETE FROM users WHERE id = ?", (user_id,))
        auth_conn.commit()
        
        print(f"✅ Admin {admin_user['username']} deleted user: {user[0]}")
        return {"message": f"User {user[0]} deleted successfully", "username": user[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
