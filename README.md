# Gian's Web Applications

## 🌐 Live Sites

Visit the applications deployed on my personal domain:

| Application | URL | Purpose |
|---|---|---|
| **Main Portal** | [gian.ink](https://gian.ink) | Personal portal & file management |
| **File Drop** | [drop.gian.ink](https://drop.gian.ink) | File sharing & upload service |
| **Finance Tracker** | [finance.gian.ink](https://finance.gian.ink) | Personal finance management |

---

## 📚 Project Overview

This is a full-stack monorepo containing multiple web applications with shared authentication, built with modern Node.js and React technologies.

### Architecture

```
webserver/
├── NodeJsBackend/          # Express.js + SQLite backends
│   ├── authServer.js       # Authentication & user management (port 3000)
│   ├── dropServer.js       # File sharing service (port 3002)
│   ├── financeServer.js    # Finance tracker API (port 3001)
│   └── Databases/          # SQLite databases (git-ignored)
│
├── main-app/               # Main portal (React + Vite)
├── drop-app/               # File sharing UI (React + Vite)
├── finance-app/            # Finance tracker UI (React + Vite)
├── flavia-app/             # Flavia application (React + Vite)
│
└── ngnix_configs/          # Nginx configuration for domains
```

### Technology Stack

- **Backend:** Node.js (Express) with SQLite, or Python
- **Frontend:** React 19 + TypeScript + Vite
- **Authentication:** JWT with refresh tokens
- **Database:** SQLite for auth, files, and finance data
- **Deployment:** Docker + Docker Compose + Nginx
- **Hosting:** Deployed on my own server using docker and nginx (and with server I mean my old crappy laptop)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- SQLite3
- Docker & Docker Compose (for production)

## 🔐 Authentication

- Centralized auth server handles user registration & login
- JWT access tokens (15 min expiry) + refresh tokens (30 days)
- User roles: standard user or admin
- Password security: bcrypt hashing with 10 salt rounds

## 📁 Key Features

### Main Portal
- User authentication & profile management
- File browsing and management with upload/delete capabilities
- Storage quota tracking

### File Drop
- Simple file upload & sharing
- Direct file download access
- File listing and deletion

### Finance Tracker
- Track expenses and income
- Financial statistics & reports
- Personal budget management

## 🛠️ Configuration

### Environment Variables

Create `.env` in `NodeJsBackend/` with:

```env
ACCESS_TOKEN_SECRET=<your-access-token-secret>
REFRESH_TOKEN_SECRET=<your-refresh-token-secret>
```

:3 ✨
