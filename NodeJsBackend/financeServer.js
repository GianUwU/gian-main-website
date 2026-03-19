require('dotenv').config()

const express = require('express')
const app = express()
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3').verbose()
const { initializeAllDatabases, financeDbPath } = require('./db')

app.use(express.json())

initializeAllDatabases().catch(err => {
    console.error('Failed to initialize databases:', err)
    process.exit(1)
})

const db = new sqlite3.Database(financeDbPath)

class ApiError extends Error {
    constructor(status, message, details) {
        super(message)
        this.status = status
        this.details = details
    }
}

function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next)
    }
}

function allSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err)
                return
            }
            resolve(rows)
        })
    })
}

function getSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err)
                return
            }
            resolve(row)
        })
    })
}

function runSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) {
                reject(err)
                return
            }
            resolve({ lastID: this.lastID, changes: this.changes })
        })
    })
}

function parseTransactionBody(body) {
    const amount = Number(body?.amount)
    const description = body?.description
    const date = body?.date
    const type = body?.type ?? 'expense'
    const categories = Array.isArray(body?.categories) ? body.categories : []

    if (!Number.isFinite(amount)) {
        throw new ApiError(400, 'amount must be a valid number')
    }
    if (typeof description !== 'string') {
        throw new ApiError(400, 'description must be a string')
    }
    if (typeof date !== 'string') {
        throw new ApiError(400, 'date must be a string')
    }
    if (type !== 'expense' && type !== 'income') {
        throw new ApiError(400, "type must be either 'expense' or 'income'")
    }
    if (!Array.isArray(categories) || categories.some(cat => typeof cat !== 'string')) {
        throw new ApiError(400, 'categories must be an array of strings')
    }

    return { amount, description, date, type, categories }
}

// Finance endpoints
app.get('/transactions', authenticateToken, asyncHandler(async (req, res) => {
    const rows = await allSql(
        "SELECT id, user_id, amount, description, date, COALESCE(type, 'expense') AS type FROM transactions WHERE user_id = ? ORDER BY date DESC, id DESC",
        [req.user.id]
    )

    const transactions = []
    for (const row of rows) {
        const txId = row.id
        const categoryRows = await allSql(
            'SELECT category FROM transaction_categories WHERE transaction_id = ? ORDER BY "order" ASC, id ASC',
            [txId]
        )

        transactions.push({
            id: txId,
            amount: row.amount,
            categories: categoryRows.map(cat => cat.category),
            description: row.description,
            date: row.date,
            type: row.type,
        })
    }

    return res.json(transactions)
}))

app.post('/transactions', authenticateToken, asyncHandler(async (req, res) => {
    const { amount, description, date, type, categories } = parseTransactionBody(req.body)

    const insertResult = await runSql(
        'INSERT INTO transactions (user_id, amount, description, date, type) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, amount, description, date, type]
    )

    const transactionId = insertResult.lastID

    for (let idx = 0; idx < categories.length; idx += 1) {
        await runSql(
            'INSERT INTO transaction_categories (transaction_id, category, "order") VALUES (?, ?, ?)',
            [transactionId, categories[idx], idx]
        )
    }

    return res.json({
        id: transactionId,
        amount,
        categories,
        description,
        date,
        type,
    })
}))

app.put('/transactions/:id', authenticateToken, asyncHandler(async (req, res) => {
    const txId = Number(req.params.id)
    if (!Number.isInteger(txId) || txId <= 0) {
        throw new ApiError(400, 'Transaction id must be a positive integer')
    }

    const { amount, description, date, type, categories } = parseTransactionBody(req.body)

    const existing = await getSql(
        'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
        [txId, req.user.id]
    )
    if (!existing) {
        throw new ApiError(404, 'Transaction not found')
    }

    await runSql(
        'UPDATE transactions SET amount = ?, description = ?, date = ?, type = ? WHERE id = ?',
        [amount, description, date, type, txId]
    )

    await runSql('DELETE FROM transaction_categories WHERE transaction_id = ?', [txId])
    for (let idx = 0; idx < categories.length; idx += 1) {
        await runSql(
            'INSERT INTO transaction_categories (transaction_id, category, "order") VALUES (?, ?, ?)',
            [txId, categories[idx], idx]
        )
    }

    return res.json({ id: txId, amount, categories, description, date, type })
}))

app.delete('/transactions/:id', authenticateToken, asyncHandler(async (req, res) => {
    const txId = Number(req.params.id)
    if (!Number.isInteger(txId) || txId <= 0) {
        throw new ApiError(400, 'Transaction id must be a positive integer')
    }

    const existing = await getSql(
        'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
        [txId, req.user.id]
    )
    if (!existing) {
        throw new ApiError(404, 'Transaction not found')
    }

    await runSql('DELETE FROM transactions WHERE id = ?', [txId])
    return res.json({ message: 'Transaction deleted' })
}))

// Authentication Middleware
function authenticateToken(req, res, next){
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return next(new ApiError(401, 'Missing access token.'))

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
        if (err) return next(new ApiError(403, 'Access token is invalid or expired.'))
        if (!payload || !Number.isInteger(payload.id) || typeof payload.username !== 'string') {
            return next(new ApiError(403, 'Access token payload is malformed.'))
        }
        req.user = {
            id: payload.id,
            username: payload.username,
            is_admin: Boolean(payload.is_admin),
        }
        return next()
    })
}

app.use((req, res, next) => {
    next(new ApiError(404, 'Route not found.'))
})

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err)
    }

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Malformed JSON body.' })
    }

    const status = Number.isInteger(err.status) ? err.status : 500
    const message = status === 500 ? 'Internal server error.' : err.message

    if (status === 500) {
        console.error('Unhandled error:', err)
    }

    const response = { error: message }
    if (err.details) {
        response.details = err.details
    }

    return res.status(status).json(response)
})

const server = app.listen(3001)

//For graceful shutdowns (e.g., when running in Docker)
process.on('SIGTERM', () => {
    db.close()
    server.closeAllConnections()
    server.close(() => process.exit(0))
})