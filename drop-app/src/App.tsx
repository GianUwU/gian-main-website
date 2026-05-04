import './App.css'
import { useAuth } from './AuthContext'
import Login from './components/Login'
import UserBadge from './components/UserBadge'
import FileDetail from './components/FileDetail'
import FileUpload from './components/FileUpload'
import FileList from './components/FileList'
import { useFileList } from './hooks/useFileList'

function App() {
  const { isLoading, isAuthenticated } = useAuth()
  const { files, loading, showMyFiles, showAllFiles, switchView, addFile, removeFile } = useFileList()
  const appBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  const path = window.location.pathname
  const routePath = appBase.length > 0
    ? (path === appBase ? '/' : (path.startsWith(`${appBase}/`) ? path.slice(appBase.length) : path))
    : path
  const supHomeboySrc = `${import.meta.env.BASE_URL}SupHomeboy.png`

  // Wait for auth to load before making routing decisions
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    )
  }

  // Route handlers
  const isLoginRoute = routePath === '/login' || routePath === '/login/'
  const downloadMatch = routePath.match(/^\/view\/([\w\-]+)\/now\/?$/i)
  const viewMatch = routePath.match(/^\/view\/([\w\-]+)\/?$/i)

  // Login route should always render the auth page.
  if (isLoginRoute) {
    return <Login />
  }

  // Instant download route
  if (downloadMatch) {
    const fileId = downloadMatch[1]
    window.location.href = `/files/${fileId}/now`
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Downloading...
      </div>
    )
  }

  // File detail route
  if (viewMatch) {
    const fileId = viewMatch[1]
    return <FileDetail fileId={fileId} />
  }

  // Main home page
  return (
    <div className="container">
      <div className="header">
        <h1>Gian Dropserver</h1>
        <p>Upload and share your files</p>
        {isAuthenticated && <UserBadge />}
      </div>

      <FileUpload onUploadSuccess={addFile} />

      <img src={supHomeboySrc} width="400" alt="SupHomeboy" className="homeboy-img" />

      <FileList
        files={files}
        loading={loading}
        showMyFiles={showMyFiles}
        showAllFiles={showAllFiles}
        onSwitchView={switchView}
        onDeleteFile={removeFile}
      />
    </div>
  )
}

export default App
