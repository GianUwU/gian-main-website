const path = require('path')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()

const databasesDir = path.join(__dirname, 'Databases')
const authDbPath = path.join(databasesDir, 'auth.db')
const financeDbPath = path.join(databasesDir, 'finance.db')
const dropDbPath = path.join(databasesDir, 'drop_files.db')

function ensureDatabasesDirectory() {
    if (!fs.existsSync(databasesDir)) {
        fs.mkdirSync(databasesDir, { recursive: true })
    }
}

function run(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, err => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

async function initializeAuthDatabase() {
    ensureDatabasesDirectory()

    const db = new sqlite3.Database(authDbPath)

    await run(db, 'PRAGMA foreign_keys = ON')

    await run(db, `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `)

    await run(db, `
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `)

    await run(db, `
        CREATE TABLE IF NOT EXISTS auth_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            username TEXT,
            attempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
            success INTEGER DEFAULT 0
        )
    `)

    await new Promise((resolve, reject) => {
        db.close(err => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

async function initializeFinanceDatabase() {
    ensureDatabasesDirectory()

    const db = new sqlite3.Database(financeDbPath)

    await run(db, 'PRAGMA foreign_keys = ON')

    await run(db, `
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            date TEXT,
            type TEXT DEFAULT 'expense'
        )
    `)

    await run(db, `
        CREATE TABLE IF NOT EXISTS transaction_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            "order" INTEGER DEFAULT 0,
            FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
            UNIQUE(transaction_id, category)
        )
    `)

    await new Promise((resolve, reject) => {
        db.close(err => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

async function initializeDropDatabase() {
    ensureDatabasesDirectory()

    const db = new sqlite3.Database(dropDbPath)

    await run(db, 'PRAGMA foreign_keys = ON')

    await run(db, `
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
    `)

    await new Promise((resolve, reject) => {
        db.close(err => {
            if (err) {
                reject(err)
                return
            }
            resolve()
        })
    })
}

async function initializeAllDatabases() {
    await initializeAuthDatabase()
    await initializeFinanceDatabase()
    await initializeDropDatabase()
}

module.exports = {
    initializeAllDatabases,
    initializeAuthDatabase,
    initializeFinanceDatabase,
    initializeDropDatabase,
    authDbPath,
    financeDbPath,
    dropDbPath,
}
