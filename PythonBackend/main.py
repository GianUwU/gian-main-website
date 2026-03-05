from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import asyncio

# Import centralized authentication system
import auth

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
    auth_cleanup_task = asyncio.create_task(cleanup_auth_attempts())
    
    yield
    
    # Cancel tasks on shutdown
    auth_cleanup_task.cancel()
    try:
        await auth_cleanup_task
    except asyncio.CancelledError:
        pass

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# FastAPI app with lifespan context manager
app = FastAPI(title="Gian Main Portal API", lifespan=lifespan)

# Add rate limiting error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://gian.ink",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

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
    return {"status": "ok", "service": "main"}

