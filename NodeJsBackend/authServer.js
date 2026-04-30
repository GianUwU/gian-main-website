require('dotenv').config()

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const sqlite3 = require('sqlite3').verbose()
const { initializeAllDatabases, authDbPath } = require('./db')

app.use(express.json())

initializeAllDatabases().catch(err => {
    console.error('Failed to initialize databases:', err)
    process.exit(1)
})

const db = new sqlite3.Database(authDbPath)

const ACCESS_COOKIE_NAME = 'accessToken'
const REFRESH_COOKIE_NAME = 'refreshToken'
const ACCESS_TOKEN_MAX_AGE_MS = 10 * 60 * 1000
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

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

const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 50
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 50

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

// PARSERS AND VALIDATORS
function parseUsername(value) {
    if (typeof value !== 'string') {
        throw new ApiError(400, 'Username is required and must be a string.')
    }

    const username = value.trim()

    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        throw new ApiError(
            400,
            `Username length must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.`
        )
    }

    const usernamePattern = /^[a-zA-Z0-9_.-]+$/
    if (!usernamePattern.test(username)) {
        throw new ApiError(400, 'Username can only contain letters, numbers, underscore, hyphen, and dot.')
    }

    return username
}

function parsePassword(value) {
    if (typeof value !== 'string') {
        throw new ApiError(400, 'Password is required and must be a string.')
    }

    if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
        throw new ApiError(
            400,
            `Password length must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`
        )
    }

    return value
}

function parseIsAdmin(value) {
    if (value === undefined) {
        return false
    }

    if (typeof value !== 'boolean') {
        throw new ApiError(400, 'is_admin must be a boolean.')
    }

    return value
}

function parseCookies(cookieHeader) {
    if (!cookieHeader) {
        return {}
    }

    return cookieHeader
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((acc, part) => {
            const idx = part.indexOf('=')
            if (idx === -1) {
                return acc
            }

            const key = part.slice(0, idx)
            const value = decodeURIComponent(part.slice(idx + 1))
            acc[key] = value
            return acc
        }, {})
}

function getCookieDomain(hostname) {
    if (typeof hostname !== 'string' || hostname.length === 0) {
        return undefined
    }

    const cleanHost = hostname.split(':')[0].toLowerCase()

    if (cleanHost === 'localhost' || cleanHost === '127.0.0.1' || cleanHost === '::1') {
        return undefined
    }

    // If env is set, it wins. Example: .gian.ink
    if (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN.trim().length > 0) {
        return process.env.COOKIE_DOMAIN.trim()
    }

    const parts = cleanHost.split('.').filter(Boolean)
    if (parts.length < 2) {
        return undefined
    }

    // Share cookies across subdomains by default in production-like hosts.
    return `.${parts.slice(-2).join('.')}`
}

function getCookieBaseOptions(req) {
    const isProduction = process.env.NODE_ENV === 'production'
    const sameSite = process.env.COOKIE_SAMESITE || (isProduction ? 'none' : 'lax')
    const secure = process.env.COOKIE_SECURE === 'true' || sameSite.toLowerCase() === 'none'
    const domain = getCookieDomain(req?.hostname)

    const options = {
        httpOnly: true,
        secure,
        sameSite,
        path: '/'
    }

    if (domain) {
        options.domain = domain
    }

    return options
}

function getCookieOptions(req, maxAgeMs) {
    return {
        ...getCookieBaseOptions(req),
        maxAge: maxAgeMs
    }
}

function setAuthCookies(req, res, accessToken, refreshToken) {
    res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(req, ACCESS_TOKEN_MAX_AGE_MS))
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getCookieOptions(req, REFRESH_TOKEN_MAX_AGE_MS))
}

function clearAuthCookies(req, res) {
    res.clearCookie(ACCESS_COOKIE_NAME, getCookieBaseOptions(req))
    res.clearCookie(REFRESH_COOKIE_NAME, getCookieBaseOptions(req))
}

function getAccessTokenFromRequest(req) {
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim()
    }

    const cookies = parseCookies(req.headers.cookie)
    return cookies[ACCESS_COOKIE_NAME] || null
}

function getRefreshTokenFromRequest(req) {
    const cookies = parseCookies(req.headers.cookie)
    const refreshToken = cookies[REFRESH_COOKIE_NAME]
    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
        throw new ApiError(401, 'Missing refresh token cookie.')
    }

    return refreshToken.trim()
}

function authenticateAccessToken(req, res, next) {
    const token = getAccessTokenFromRequest(req)

    if (!token) {
        return next(new ApiError(401, 'Missing access token.'))
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
        if (err) {
            return next(new ApiError(403, 'Access token is invalid or expired.'))
        }

        if (!payload || !Number.isInteger(payload.id) || typeof payload.username !== 'string') {
            return next(new ApiError(403, 'Access token payload is malformed.'))
        }

        req.user = {
            id: payload.id,
            username: payload.username,
            is_admin: Boolean(payload.is_admin)
        }

        return next()
    })
}

app.post('/token', asyncHandler(async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req)

    let user
    try {
        user = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET)
    } catch {
        throw new ApiError(403, 'Refresh token is expired or invalid.')
    }

    if (!user || !Number.isInteger(user.id) || typeof user.username !== 'string') {
        throw new ApiError(403, 'Refresh token payload is malformed.')
    }

    const tokenRow = await getSql(
        `SELECT rt.token, rt.user_id, u.username, u.is_admin
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token = ?`,
        [refreshToken]
    )

    if (!tokenRow) {
        throw new ApiError(403, 'Refresh token is invalid or has been revoked.')
    }

    if (tokenRow.user_id !== user.id || tokenRow.username !== user.username) {
        throw new ApiError(403, 'Refresh token user mismatch.')
    }

    const accessToken = generateAccessToken({
        id: tokenRow.user_id,
        username: tokenRow.username,
        is_admin: Boolean(tokenRow.is_admin)
    })

    res.cookie(ACCESS_COOKIE_NAME, accessToken, getCookieOptions(req, ACCESS_TOKEN_MAX_AGE_MS))
    res.json({ message: 'Access token refreshed.' })
}))


// GET and POST Requests for Registration and Login

// send all users with their data
app.get('/users', asyncHandler(async (req, res) => {
    const rows = await allSql('SELECT id, username, is_admin FROM users ORDER BY username')
    res.json(rows.map(row => ({
        id: row.id,
        username: row.username,
        is_admin: Boolean(row.is_admin)
    })))
}))

app.get('/users/info', authenticateAccessToken, asyncHandler(async (req,res) => {
    const user = await getSql(
        'SELECT id, username, is_admin FROM users WHERE id = ?',
        [req.user.id]
    )

    if (!user) {
        throw new ApiError(404, 'User not found.')
    }

    res.json({
            id: req.user.id,
            username: user.username,
            is_admin: Boolean(user.is_admin)
       })
}))

// Register User
app.post('/users/register', asyncHandler(async (req, res) => {
    const submittedUsername = parseUsername(req.body?.username)
    const submittedPassword = parsePassword(req.body?.password)
    const submittedIsAdmin = parseIsAdmin(req.body?.is_admin)

    const hashedPassword = await bcrypt.hash(submittedPassword, 10)

    let created
    try {
        created = await runSql(
            'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)',
            [submittedUsername, hashedPassword, submittedIsAdmin ? 1 : 0]
        )
    } catch (err) {
        if (err && err.code === 'SQLITE_CONSTRAINT') {
            throw new ApiError(409, 'Username already registered.')
        }
        throw err
    }

    res.status(201).json({
        message: 'User registered successfully.',
        user: {
            id: created.lastID,
            username: submittedUsername,
            is_admin: submittedIsAdmin
        }
    })
}))

app.delete('/users/logout', asyncHandler(async (req, res) => {
    const refreshToken = getRefreshTokenFromRequest(req)

    // Resolve the user_id from the token, then delete all their refresh tokens
    const tokenRow = await getSql(
        'SELECT user_id FROM refresh_tokens WHERE token = ?',
        [refreshToken]
    )

    if (!tokenRow) {
        throw new ApiError(403, 'Refresh token is invalid or has already been revoked.')
    }

    await runSql('DELETE FROM refresh_tokens WHERE user_id = ?', [tokenRow.user_id])
    clearAuthCookies(req, res)
    res.sendStatus(204)
}))

// Change password
app.post('/users/change-password', authenticateAccessToken, asyncHandler(async (req, res) => {
    const currentPassword = req.body?.current_password
    const newPassword = req.body?.new_password

    if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
        throw new ApiError(400, 'current_password is required.')
    }

    const validatedNewPassword = parsePassword(newPassword)

    const user = await getSql(
        'SELECT id, password FROM users WHERE id = ?',
        [req.user.id]
    )

    if (!user) {
        throw new ApiError(404, 'User not found.')
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentValid) {
        throw new ApiError(401, 'Current password is incorrect.')
    }

    const hashedNew = await bcrypt.hash(validatedNewPassword, 10)
    await runSql('UPDATE users SET password = ? WHERE id = ?', [hashedNew, req.user.id])

    // Revoke all refresh tokens so all other sessions are logged out
    await runSql('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id])

    clearAuthCookies(req, res)

    res.json({ message: 'Password changed successfully. All sessions have been logged out.' })
}))

// Login User
app.post('/users/login', asyncHandler(async (req, res) => {
    const submittedUsername = parseUsername(req.body?.username)
    const submittedPassword = parsePassword(req.body?.password)

    const user = await getSql(
        'SELECT id, username, password, is_admin FROM users WHERE lower(username) = lower(?)',
        [submittedUsername]
    )

    if (!user) {
        throw new ApiError(401, 'Invalid username.')
    }

    const isPasswordValid = await bcrypt.compare(submittedPassword, user.password)
    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid password.')
    }

    const tokenPayload = {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin
    }

    const accessToken = generateAccessToken(tokenPayload)
    const refreshToken = jwt.sign(tokenPayload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '30d' })

    const decodedRefresh = jwt.decode(refreshToken)
    if (!decodedRefresh || !decodedRefresh.exp) {
        throw new ApiError(500, 'Failed to create refresh token metadata.')
    }

    const expiresAt = new Date(decodedRefresh.exp * 1000).toISOString()
    await runSql(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, refreshToken, expiresAt]
    )

    setAuthCookies(req, res, accessToken, refreshToken)
    res.json({
        message: 'Login successful.',
        user: {
            id: user.id,
            username: user.username,
            is_admin: Boolean(user.is_admin)
        }
    })
}))

function generateAccessToken(user){
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '10m' })
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

const server = app.listen(3000)


//For graceful shutdown (e.g., when running in Docker)
process.on('SIGTERM', () => {
    db.close()
    server.closeAllConnections()
    server.close(() => process.exit(0))
})