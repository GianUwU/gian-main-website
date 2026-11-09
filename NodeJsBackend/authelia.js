const crypto = require('crypto')

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

function runSql(db, sql, params = []) {
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

function getSql(db, sql, params = []) {
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

async function findOrCreateAutheliaUser(authDb, rawUsername, meta = {}) {
    if (!rawUsername || typeof rawUsername !== 'string') {
        return null
    }

    const username = rawUsername.trim()
    if (!username) {
        return null
    }

    // Lookup existing user case-insensitively
    let existingUser = await getSql(
        authDb,
        'SELECT id, username, is_admin FROM users WHERE lower(username) = lower(?)',
        [username]
    )

    const groupsStr = (meta.groups || '').toLowerCase()
    const isAdmin = Boolean(
        groupsStr.includes('admins') ||
        groupsStr.includes('admin') ||
        username.toLowerCase() === 'gian' ||
        username.toLowerCase() === 'admin'
    )

    if (existingUser) {
        if (isAdmin && !existingUser.is_admin) {
            await runSql(authDb, 'UPDATE users SET is_admin = 1 WHERE id = ?', [existingUser.id])
            existingUser.is_admin = 1
        }
        return {
            id: existingUser.id,
            username: existingUser.username,
            is_admin: Boolean(existingUser.is_admin)
        }
    }

    // Auto-provision user if they exist in Authelia but not in local DB
    const placeholderHash = 'authelia_' + crypto.randomBytes(32).toString('hex')
    const result = await runSql(
        authDb,
        'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)',
        [username, placeholderHash, isAdmin ? 1 : 0]
    )

    return {
        id: result.lastID,
        username: username,
        is_admin: isAdmin
    }
}

async function getAutheliaUser(req, authDb) {
    if (!authDb) {
        return null
    }

    // 1. Direct proxy headers (e.g. from Traefik ForwardAuth middleware)
    const headerUser = req.headers['remote-user'] || req.headers['x-forwarded-user']
    if (headerUser && typeof headerUser === 'string' && headerUser.trim().length > 0) {
        return await findOrCreateAutheliaUser(authDb, headerUser, {
            groups: req.headers['remote-groups'],
            name: req.headers['remote-name'],
            email: req.headers['remote-email']
        })
    }

    // 2. Browser session cookie (when hit directly or during transition)
    const cookies = parseCookies(req.headers.cookie)
    const autheliaSession = cookies['authelia_session']
    if (!autheliaSession) {
        return null
    }

    const forwardAuthUrl = process.env.AUTHELIA_FORWARD_AUTH_URL || 'http://authelia:9091/api/authz/forward-auth'
    try {
        const targetHost = req.headers.host || req.hostname || 'gian.ink'
        const isLocal = targetHost.includes('localhost') || targetHost.includes('127.0.0.1')
        const targetProto = isLocal ? 'http' : (req.headers['x-forwarded-proto'] === 'http' && isLocal ? 'http' : 'https')
        const response = await fetch(forwardAuthUrl, {
            method: 'GET',
            headers: {
                'Cookie': `authelia_session=${autheliaSession}`,
                'X-Forwarded-Method': req.method || 'GET',
                'X-Forwarded-Proto': targetProto,
                'X-Forwarded-Host': targetHost,
                'X-Forwarded-URI': req.originalUrl || '/'
            },
            signal: AbortSignal.timeout(3000)
        })

        if (response.status === 200) {
            const user = response.headers.get('remote-user')
            if (user) {
                return await findOrCreateAutheliaUser(authDb, user, {
                    groups: response.headers.get('remote-groups') || '',
                    name: response.headers.get('remote-name') || '',
                    email: response.headers.get('remote-email') || ''
                })
            }
        }
    } catch {
        // Authelia unreachable or timed out
    }

    return null
}

module.exports = {
    parseCookies,
    getAutheliaUser,
    findOrCreateAutheliaUser
}
