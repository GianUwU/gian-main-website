const path = require('path')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()

const databasesDir = path.join(__dirname, 'Databases')
const authDbPath = path.join(databasesDir, 'auth.db')

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

async function initializeAllDatabases() {
    await initializeAuthDatabase()
}

module.exports = {
    initializeAllDatabases,
    initializeAuthDatabase,
    authDbPath,
}
