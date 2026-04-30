require('dotenv').config()

const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const sqlite3 = require('sqlite3').verbose()
const { initializeAllDatabases, authDbPath, dropDbPath } = require('./db')

const app = express()
app.use(express.json())

initializeAllDatabases().catch(err => {
    console.error('Failed to initialize databases:', err)
    process.exit(1)
})

const UPLOAD_DIR = path.join(__dirname, 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const authDb = new sqlite3.Database(authDbPath)
const filesDb = new sqlite3.Database(dropDbPath)
const ACCESS_COOKIE_NAME = 'accessToken'

class ApiError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}

function asyncHandler(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next)
    }
}

function runSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        filesDb.run(sql, params, function onRun(err) {
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
        filesDb.get(sql, params, (err, row) => {
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
        filesDb.all(sql, params, (err, rows) => {
            if (err) {
                reject(err)
                return
            }
            resolve(rows)
        })
    })
}

function getAuthSql(sql, params = []) {
    return new Promise((resolve, reject) => {
        authDb.get(sql, params, (err, row) => {
            if (err) {
                reject(err)
                return
            }
            resolve(row)
        })
    })
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

function getTokenFromRequest(req) {
    const authHeader = req.headers['authorization']
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim()
    }

    const cookies = parseCookies(req.headers.cookie)
    return cookies[ACCESS_COOKIE_NAME] || null
}

function authenticateAccessToken(req, res, next) {
    const token = getTokenFromRequest(req)

    if (!token) {
        return next(new ApiError(401, 'Not authenticated'))
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, payload) => {
        if (err) {
            return next(new ApiError(403, 'Access token is invalid or expired.'))
        }

        if (!payload || !Number.isInteger(payload.id) || typeof payload.username !== 'string') {
            return next(new ApiError(403, 'Access token payload is malformed.'))
        }

        try {
            const user = await getAuthSql(
                'SELECT id, username, is_admin FROM users WHERE id = ?',
                [payload.id]
            )

            if (!user) {
                return next(new ApiError(401, 'User not found'))
            }

            req.user = {
                id: user.id,
                username: user.username,
                is_admin: Boolean(user.is_admin),
            }

            return next()
        } catch (dbErr) {
            return next(dbErr)
        }
    })
}

function validateDescription(description) {
    const text = typeof description === 'string' ? description : ''
    if (text.length > 1000) {
        throw new ApiError(400, 'Description too long (max 1000 characters)')
    }

    return text.replace(/<[^>]*>/g, '').trim()
}

function validateFilename(filename) {
    if (typeof filename !== 'string' || filename.trim().length === 0) {
        throw new ApiError(400, 'Filename cannot be empty')
    }

    if (filename.length > 255) {
        throw new ApiError(400, 'Filename too long (max 255 characters)')
    }

    return filename.replace(/[<>:"/\\|?*]/g, '_').trim().replace(/^[.\s]+|[.\s]+$/g, '')
}

function parseExpirationDays(value) {
    if (value === undefined || value === null || value === '') {
        return null
    }

    const days = Number(value)
    if (!Number.isInteger(days)) {
        throw new ApiError(400, 'expiration_days must be an integer')
    }

    if (days < 0) {
        throw new ApiError(400, 'Expiration days cannot be negative')
    }

    if (days > 365) {
        throw new ApiError(400, 'Maximum expiration is 365 days')
    }

    if (days === 0) {
        return null
    }

    return days
}

function parseIsPrivate(value) {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true' || value === '1'
    }
    return false
}

function randomId(length) {
    return crypto.randomBytes(Math.ceil(length)).toString('base64url').slice(0, length)
}

function getFileExtension(filename) {
    return path.extname(filename || '').slice(0, 20)
}

async function generateUniqueFileId() {
    while (true) {
        const id = randomId(8)
        const row = await getSql('SELECT id FROM files WHERE id = ?', [id])
        if (!row) {
            return id
        }
    }
}

function safeUnlink(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
    } catch (err) {
        console.warn('Failed to delete file:', filePath, err)
    }
}

function computeUploadsSizeBytes() {
    let total = 0
    const entries = fs.readdirSync(UPLOAD_DIR)
    for (const entry of entries) {
        const fullPath = path.join(UPLOAD_DIR, entry)
        try {
            const st = fs.statSync(fullPath)
            if (st.isFile()) {
                total += st.size
            }
        } catch {
            // Ignore files that disappear during scan.
        }
    }
    return total
}

function mapFileRow(row) {
    return {
        id: row.id,
        filename: row.filename,
        original_filename: row.original_filename,
        description: row.description,
        username: row.username,
        user_id: row.user_id,
        uploaded_at: row.uploaded_at,
        file_size: row.file_size,
        file_type: row.file_type,
        is_private: Boolean(row.is_private),
        expires_at: row.expires_at,
        batch_id: row.batch_id,
        file_path: row.file_path,
    }
}

async function withBatchSummaries(rows) {
    const seenBatches = new Set()
    const out = []

    for (const row of rows) {
        if (row.batch_id) {
            if (seenBatches.has(row.batch_id)) {
                continue
            }
            seenBatches.add(row.batch_id)

            const batchInfo = await getSql(
                'SELECT COUNT(*) AS total_files, SUM(file_size) AS total_size FROM files WHERE batch_id = ?',
                [row.batch_id]
            )

            out.push({
                ...mapFileRow(row),
                total_files: batchInfo ? batchInfo.total_files : 1,
                total_size: batchInfo ? batchInfo.total_size : row.file_size,
            })
            continue
        }

        out.push({
            ...mapFileRow(row),
            total_files: null,
            total_size: null,
        })
    }

    return out
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024
const MAX_STORAGE_BYTES = 50 * 1024 * 1024 * 1024

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR)
    },
    filename: (_req, file, cb) => {
        const ext = getFileExtension(file.originalname)
        cb(null, `${randomId(12)}${ext}`)
    },
})

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 100,
    },
})

app.use('/uploads', express.static(UPLOAD_DIR))

app.post('/upload', authenticateAccessToken, (req, res, next) => {
    upload.array('files')(req, res, async err => {
        if (err) {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                return next(new ApiError(413, 'File too large. Maximum file size is 5GB.'))
            }
            return next(err)
        }

        try {
            const files = Array.isArray(req.files) ? req.files : []
            if (files.length === 0) {
                throw new ApiError(400, 'Please select at least one file')
            }

            const description = validateDescription(req.body.description)
            const isPrivate = parseIsPrivate(req.body.is_private)
            const expirationDays = parseExpirationDays(req.body.expiration_days)

            const currentStorage = computeUploadsSizeBytes()
            const incomingBytes = files.reduce((sum, file) => sum + (file.size || 0), 0)
            if (currentStorage + incomingBytes > MAX_STORAGE_BYTES) {
                files.forEach(file => safeUnlink(file.path))
                throw new ApiError(507, 'Server storage is full (50GB limit reached). Please contact administrator.')
            }

            const batchId = files.length > 1 ? randomId(12) : null
            const uploadedAt = new Date().toISOString()
            const expiresAt = expirationDays ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString() : null

            const inserted = []
            for (const file of files) {
                const originalFilename = validateFilename(file.originalname)
                const id = await generateUniqueFileId()

                await runSql(
                    `INSERT INTO files (
                        id, filename, original_filename, description, username, user_id, uploaded_at,
                        file_size, file_type, is_private, expires_at, batch_id, file_path
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        file.filename,
                        originalFilename,
                        description,
                        req.user.username,
                        req.user.id,
                        uploadedAt,
                        file.size,
                        file.mimetype || 'application/octet-stream',
                        isPrivate ? 1 : 0,
                        expiresAt,
                        batchId,
                        originalFilename,
                    ]
                )

                inserted.push({
                    id,
                    filename: file.filename,
                    original_filename: originalFilename,
                })
            }

            const first = inserted[0]
            const firstRow = await getSql('SELECT * FROM files WHERE id = ?', [first.id])
            res.json({
                status: 'ok',
                file: {
                    ...mapFileRow(firstRow),
                    total_files: inserted.length,
                },
            })
        } catch (uploadErr) {
            const files = Array.isArray(req.files) ? req.files : []
            files.forEach(file => safeUnlink(file.path))
            next(uploadErr)
        }
    })
})

app.get('/files', asyncHandler(async (req, res) => {
    const offset = Number(req.query.offset ?? 0)
    const limit = Number(req.query.limit ?? 15)

    const rows = await allSql(
        `SELECT *
         FROM files
         WHERE is_private = 0
         ORDER BY uploaded_at DESC
         LIMIT ? OFFSET ?`,
        [Math.max(limit, 1), Math.max(offset, 0)]
    )

    res.json(await withBatchSummaries(rows))
}))

app.get('/files/my', authenticateAccessToken, asyncHandler(async (req, res) => {
    const offset = Number(req.query.offset ?? 0)
    const limit = Number(req.query.limit ?? 15)

    const rows = await allSql(
        `SELECT *
         FROM files
         WHERE user_id = ?
         ORDER BY uploaded_at DESC
         LIMIT ? OFFSET ?`,
        [req.user.id, Math.max(limit, 1), Math.max(offset, 0)]
    )

    res.json(await withBatchSummaries(rows))
}))

app.get('/files/all', authenticateAccessToken, asyncHandler(async (req, res) => {
    if (!req.user.is_admin) {
        throw new ApiError(403, 'Admin access required')
    }

    const offset = Number(req.query.offset ?? 0)
    const limit = Number(req.query.limit ?? 15)

    const rows = await allSql(
        `SELECT *
         FROM files
         ORDER BY uploaded_at DESC
         LIMIT ? OFFSET ?`,
        [Math.max(limit, 1), Math.max(offset, 0)]
    )

    res.json(await withBatchSummaries(rows))
}))

app.get('/files/:fileId', asyncHandler(async (req, res) => {
    const fileRow = await getSql('SELECT * FROM files WHERE id = ?', [req.params.fileId])
    if (!fileRow) {
        throw new ApiError(404, 'File not found')
    }

    if (fileRow.batch_id) {
        const batchRows = await allSql(
            'SELECT * FROM files WHERE batch_id = ? ORDER BY file_path',
            [fileRow.batch_id]
        )
        res.json({
            is_batch: true,
            batch_id: fileRow.batch_id,
            files: batchRows.map(mapFileRow),
        })
        return
    }

    res.json({
        ...mapFileRow(fileRow),
        batch_id: null,
    })
}))

app.get('/files/:fileId/now', asyncHandler(async (req, res) => {
    const fileRow = await getSql(
        'SELECT filename, original_filename FROM files WHERE id = ?',
        [req.params.fileId]
    )

    if (!fileRow) {
        throw new ApiError(404, 'File not found')
    }

    const fullPath = path.join(UPLOAD_DIR, fileRow.filename)
    if (!fs.existsSync(fullPath)) {
        throw new ApiError(404, 'File not found on server')
    }

    res.download(fullPath, fileRow.original_filename)
}))

app.delete('/files/:fileId', authenticateAccessToken, asyncHandler(async (req, res) => {
    const fileRow = await getSql(
        'SELECT id, filename, user_id, batch_id FROM files WHERE id = ?',
        [req.params.fileId]
    )

    if (!fileRow) {
        throw new ApiError(404, 'File not found')
    }

    if (fileRow.user_id !== req.user.id && !req.user.is_admin) {
        throw new ApiError(403, 'You can only delete your own files')
    }

    let filesToDelete = []
    if (fileRow.batch_id) {
        filesToDelete = await allSql(
            'SELECT id, filename FROM files WHERE batch_id = ?',
            [fileRow.batch_id]
        )
        await runSql('DELETE FROM files WHERE batch_id = ?', [fileRow.batch_id])
    } else {
        filesToDelete = [fileRow]
        await runSql('DELETE FROM files WHERE id = ?', [fileRow.id])
    }

    for (const file of filesToDelete) {
        safeUnlink(path.join(UPLOAD_DIR, file.filename))
    }

    const count = filesToDelete.length
    res.json({
        status: 'ok',
        message: `${count} file${count > 1 ? 's' : ''} deleted successfully`,
    })
}))

app.get('/storage-info', asyncHandler(async (_req, res) => {
    const usedBytes = computeUploadsSizeBytes()
    const usedGb = usedBytes / (1024 ** 3)
    const maxGb = 50

    res.json({
        used_gb: Number(usedGb.toFixed(2)),
        max_gb: maxGb,
        percentage: Number(((usedGb / maxGb) * 100).toFixed(1)),
        is_full: usedGb >= maxGb,
    })
}))

async function cleanupExpiredFiles() {
    const now = new Date().toISOString()
    const expired = await allSql(
        'SELECT id, filename FROM files WHERE expires_at IS NOT NULL AND expires_at <= ?',
        [now]
    )

    for (const row of expired) {
        safeUnlink(path.join(UPLOAD_DIR, row.filename))
    }

    if (expired.length > 0) {
        await runSql('DELETE FROM files WHERE expires_at IS NOT NULL AND expires_at <= ?', [now])
    }
}

setInterval(() => {
    cleanupExpiredFiles().catch(err => {
        console.error('Failed to cleanup expired files:', err)
    })
}, 60 * 60 * 1000)

app.use((req, res, next) => {
    next(new ApiError(404, 'Route not found'))
})

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err)
    }

    const status = Number.isInteger(err.status) ? err.status : 500
    const message = status === 500 ? 'Internal server error.' : err.message

    if (status === 500) {
        console.error('Unhandled drop server error:', err)
    }

    res.status(status).json({ detail: message })
})

const server = app.listen(3002)

process.on('SIGTERM', () => {
    authDb.close()
    filesDb.close()
    server.closeAllConnections()
    server.close(() => process.exit(0))
})
