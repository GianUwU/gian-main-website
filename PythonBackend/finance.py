from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Literal
import sqlite3

# Import centralized authentication system
import auth

app = FastAPI()

origins = [
    "https://finance.gian.ink",
    "http://localhost:5175",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Finance database (only transactions, no user data)
conn = sqlite3.connect("finance.db", check_same_thread=False)
c = conn.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    date TEXT,
    type TEXT DEFAULT 'expense'
)
""")

# Create junction table for multiple categories per transaction
c.execute("""
CREATE TABLE IF NOT EXISTS transaction_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    UNIQUE(transaction_id, category)
)
"""
)
conn.commit()

# Add order column if it doesn't exist (for migration)
try:
    c.execute('SELECT "order" FROM transaction_categories LIMIT 1')
except sqlite3.OperationalError:
    c.execute('ALTER TABLE transaction_categories ADD COLUMN "order" INTEGER DEFAULT 0')
    conn.commit()

try:
    c.execute("SELECT type FROM transactions LIMIT 1")
except sqlite3.OperationalError:
    c.execute("ALTER TABLE transactions ADD COLUMN type TEXT DEFAULT 'expense'")
    conn.commit()

# Models
class Transaction(BaseModel):
    id: int | None = None
    amount: float
    categories: List[str] = []
    description: str
    date: str
    type: Literal["expense", "income"] = "expense"

# Authentication endpoints (delegated to auth.py)
@app.post("/register", response_model=auth.User)
def register(user: auth.User, request: Request):
    return auth.register_user(user, request)

@app.post("/token", response_model=auth.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), request: Request = None):
    return auth.login_user(form_data, request)

@app.get("/user/info")
def get_user_info(current_user: dict = Depends(auth.get_current_user)):
    return current_user

@app.post("/change-password")
def change_password(password_change: auth.PasswordChange, request: Request, current_user: dict = Depends(auth.get_current_user)):
    return auth.change_user_password(password_change, current_user, request)

@app.post("/refresh")
def refresh_token(refresh_request: auth.RefreshTokenRequest, request: Request):
    """Get a new access token using a refresh token"""
    return auth.refresh_access_token(refresh_request, request)

@app.post("/logout")
def logout(current_user: dict = Depends(auth.get_current_user), refresh_token: str = None):
    """Logout and revoke refresh tokens"""
    return auth.logout_user(current_user, refresh_token)

# Finance endpoints
@app.get("/transactions", response_model=List[Transaction])
def get_transactions(current_user: dict = Depends(auth.get_current_user)):
    try:
        c.execute(
            "SELECT id, user_id, amount, description, date, COALESCE(type, 'expense') FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC",
            (current_user["id"],)
        )
        rows = c.fetchall()
        
        transactions = []
        for row in rows:
            tx_id = row[0]
            # Get all categories for this transaction in insertion order
            c.execute(
                "SELECT category FROM transaction_categories WHERE transaction_id = ? ORDER BY \"order\" ASC, id ASC",
                (tx_id,)
            )
            categories = [cat[0] for cat in c.fetchall()]
            
            transactions.append(
                Transaction(
                    id=tx_id,
                    amount=row[2],
                    categories=categories,
                    description=row[3],
                    date=row[4],
                    type=row[5]
                )
            )
        
        return transactions
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/transactions", response_model=Transaction)
def add_transaction(tx: Transaction, current_user: dict = Depends(auth.get_current_user)):
    try:
        c.execute(
            "INSERT INTO transactions (user_id, amount, description, date, type) VALUES (?, ?, ?, ?, ?)",
            (current_user["id"], tx.amount, tx.description, tx.date, tx.type)
        )
        conn.commit()
        tx.id = c.lastrowid
        
        # Insert categories with order index
        for idx, category in enumerate(tx.categories):
            c.execute(
                "INSERT INTO transaction_categories (transaction_id, category, \"order\") VALUES (?, ?, ?)",
                (tx.id, category, idx)
            )
        conn.commit()
        
        return tx
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/transactions/{tx_id}", response_model=Transaction)
def update_transaction(tx_id: int, tx: Transaction, current_user: dict = Depends(auth.get_current_user)):
    try:
        c.execute("SELECT id FROM transactions WHERE id = ? AND user_id = ?", (tx_id, current_user["id"]))
        if not c.fetchone():
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        c.execute(
            "UPDATE transactions SET amount = ?, description = ?, date = ?, type = ? WHERE id = ?",
            (tx.amount, tx.description, tx.date, tx.type, tx_id)
        )
        
        # Delete old categories and insert new ones
        c.execute("DELETE FROM transaction_categories WHERE transaction_id = ?", (tx_id,))
        for idx, category in enumerate(tx.categories):
            c.execute(
                "INSERT INTO transaction_categories (transaction_id, category, \"order\") VALUES (?, ?, ?)",
                (tx_id, category, idx)
            )
        
        conn.commit()
        tx.id = tx_id
        return tx
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/transactions/{tx_id}")
def delete_transaction(tx_id: int, current_user: dict = Depends(auth.get_current_user)):
    try:
        c.execute("SELECT id FROM transactions WHERE id = ? AND user_id = ?", (tx_id, current_user["id"]))
        if not c.fetchone():
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        c.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
        conn.commit()
        return {"message": "Transaction deleted"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/users")
def get_all_users_with_data(admin_user: dict = Depends(auth.get_admin_user)):
    """Get all users with their finance statistics"""
    try:
        # Get all users from auth system
        users = auth.get_all_users(admin_user)
        
        result = []
        for user in users:
            user_id = user["id"]
            
            # Get transaction stats from finance database
            c.execute("""
                SELECT 
                    COUNT(*) as total_transactions,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income
                FROM transactions 
                WHERE user_id = ?
            """, (user_id,))
            stats = c.fetchone()
            
            # Get recent transactions with categories
            c.execute("""
                SELECT id, amount, description, date, COALESCE(type, 'expense') as type
                FROM transactions 
                WHERE user_id = ? 
                ORDER BY date DESC, id DESC 
                LIMIT 10
            """, (user_id,))
            recent_txs = c.fetchall()
            
            recent_transactions = []
            for tx in recent_txs:
                tx_id = tx[0]
                # Get categories for this transaction
                c.execute(
                    "SELECT category FROM transaction_categories WHERE transaction_id = ? ORDER BY category",
                    (tx_id,)
                )
                categories = [cat[0] for cat in c.fetchall()]
                
                recent_transactions.append({
                    "id": tx_id,
                    "amount": tx[1],
                    "categories": categories,
                    "description": tx[2],
                    "date": tx[3],
                    "type": tx[4]
                })
            
            result.append({
                "id": user_id,
                "username": user["username"],
                "is_admin": user["is_admin"],
                "stats": {
                    "total_transactions": stats[0],
                    "total_expenses": stats[1],
                    "total_income": stats[2]
                },
                "recent_transactions": recent_transactions
            })
        
        return result
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/reset-password")
def admin_reset_password(reset: auth.AdminPasswordReset, request: Request, admin_user: dict = Depends(auth.get_admin_user)):
    return auth.admin_reset_user_password(reset, admin_user, request)

@app.post("/admin/update-admin-status")
def admin_update_admin_status(status_update: auth.AdminStatusUpdate, admin_user: dict = Depends(auth.get_admin_user)):
    return auth.admin_update_user_admin_status(status_update, admin_user)

@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin_user: dict = Depends(auth.get_admin_user)):
    """Delete user and all their finance data"""
    try:
        # Delete all user's transactions from finance database
        c.execute("DELETE FROM transactions WHERE user_id = ?", (user_id,))
        conn.commit()
        
        # Delete the user from auth database
        result = auth.admin_delete_user(user_id, admin_user)
        
        print(f"✅ Deleted all finance data for user: {result.get('username', user_id)}")
        return result
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5173)
