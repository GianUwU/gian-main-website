import './App.css'
import Login from './components/Login'

function App() {
  const path = window.location.pathname

  // Route handlers
  const isLoginRoute = path === '/login' || path === '/login/'

  // Show login page only if explicitly on /login route
  if (isLoginRoute) {
    return <Login />
  }

  // Main landing page
  return (
    <div className="landing-page">
      <div className="landing-content">
        <h1>Gian</h1>
        <p className="subtitle">Welcome to my Website</p>

        <div className="apps-section">
          <h2>My Projects</h2>
          <div className="apps-links">
            <a href="https://finance.gian.ink" className="app-link">
              <span className="app-icon">💰</span>
              <h3>Finance Tracker</h3>
            </a>
            <a href="https://drop.gian.ink" className="app-link">
              <span className="app-icon">📁</span>
              <h3>Drop</h3>
            </a>
          </div>
        </div>
        
        <div className="socials-section">
          <h2>Connect with me</h2>
          <div className="socials-links">
            <a href="https://www.youtube.com/@ggentertainment2737" target="_blank" rel="noopener noreferrer" className="social-link">
              🎥 YouTube
            </a>
            <a href="https://www.instagram.com/therealgian2/" target="_blank" rel="noopener noreferrer" className="social-link">
              📸 Instagram
            </a>
            <a href="https://github.com/GianUwU" target="_blank" rel="noopener noreferrer" className="social-link">
              💻 GitHub
            </a>
            <a href="mailto:gian@gaudi.ch" className="social-link">
              ✉️ gian@gaudi.ch
            </a>
          </div>
        </div>

        <footer className="page-footer">
          <p>All pages built by Gian with the help of GitHub Copilot</p>
        </footer>
      </div>
    </div>
  )
}

export default App
