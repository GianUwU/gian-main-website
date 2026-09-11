import { useState, useEffect, useRef } from 'react'
import './App.css'
import Login from './components/Login'

interface ProjectItem {
  id: string
  title: string
  icon: string
  url: string
  githubUrl?: string
  description: string
  image: string
  imageAlt: string
}

function App() {
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  const path = window.location.pathname
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const financeUrl = isLocalhost ? 'http://localhost:5175' : 'https://finance.gian.ink'

  const projects: ProjectItem[] = [
    {
      id: 'mtg',
      title: 'MTG Tabletop Sync',
      icon: '⚔️',
      url: 'https://mtg.gian.ink',
      githubUrl: 'https://github.com/GianUwU/mtg-tabletop-sync',
      description: 'Real-time synchronized tabletop tracker for Magic: The Gathering matches with multi-device phone controls.',
      image: '/mtg_preview.jpeg',
      imageAlt: 'MTG Tabletop Sync Preview',
    },
    {
      id: 'finance',
      title: 'Finance Tracker',
      icon: '💰',
      url: financeUrl,
      githubUrl: 'https://github.com/GianUwU/gian-main-website',
      description: 'Personal budget management and expense analytics dashboard.',
      image: '/finance_stats.png',
      imageAlt: 'Finance Tracker Stats Preview',
    },
    {
      id: 'drop',
      title: 'Drop',
      icon: '📁',
      url: 'https://drop.gian.ink',
      githubUrl: 'https://github.com/GianUwU/gian-main-website',
      description: 'Self-hosted cloud storage and fast file sharing with downloads without login.',
      image: '/drop_entry.png',
      imageAlt: 'Drop Upload Portal Preview',
    },
  ]

  // Auto-foldout on mobile for top card at top of page, or card closest to center
  useEffect(() => {
    const isMobile = () => window.innerWidth <= 768

    const updateActiveMobileCard = () => {
      if (!isMobile()) return

      // If at or near top of the page, automatically fold out the top card
      if (window.scrollY < 120) {
        setActiveCardId(projects[0].id)
        return
      }

      const viewportCenter = window.innerHeight / 2
      let closestId: string | null = null
      let minDistance = Infinity

      projects.forEach((p) => {
        const el = cardRefs.current[p.id]
        if (el) {
          const rect = el.getBoundingClientRect()
          const cardCenter = rect.top + rect.height / 2
          const dist = Math.abs(cardCenter - viewportCenter)
          if (dist < minDistance) {
            minDistance = dist
            closestId = p.id
          }
        }
      })

      if (closestId) {
        setActiveCardId(closestId)
      }
    }

    if (isMobile()) {
      updateActiveMobileCard()
    }

    let ticking = false
    const onScrollOrResize = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (isMobile()) {
            updateActiveMobileCard()
          } else {
            setActiveCardId(null)
          }
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', onScrollOrResize, { passive: true })
    window.addEventListener('resize', onScrollOrResize)

    return () => {
      window.removeEventListener('scroll', onScrollOrResize)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [])

  const handleMouseEnter = (id: string) => {
    if (window.innerWidth > 768) {
      setActiveCardId(id)
    }
  }

  const handleMouseLeave = () => {
    if (window.innerWidth > 768) {
      setActiveCardId(null)
    }
  }

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
        <header className="page-header">
          <h1>Gian</h1>
          <p className="subtitle">Welcome to my Website</p>
        </header>

        <section className="apps-section">
          <h2>My Projects</h2>
          <div className="apps-links">
            {projects.map((project) => {
              const isOpen = activeCardId === project.id
              return (
                <div 
                  key={project.id} 
                  ref={(el) => { cardRefs.current[project.id] = el }}
                  className={`app-card-wrapper ${isOpen ? 'is-open' : ''}`}
                  onMouseEnter={() => handleMouseEnter(project.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <a 
                    href={project.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`app-link ${isOpen ? 'is-open' : ''}`}
                  >
                    <div className="app-card-header">
                      <span className="app-icon">{project.icon}</span>
                      <h3>{project.title}</h3>
                    </div>

                    <div className={`app-foldout-wrapper ${isOpen ? 'is-open' : ''}`}>
                      <div className="app-foldout-content">
                        <p className="app-foldout-desc">{project.description}</p>
                        <div className="app-foldout-img-wrapper">
                          <img 
                            src={project.image} 
                            alt={project.imageAlt} 
                            className="app-foldout-img" 
                            loading="lazy" 
                          />
                        </div>
                      </div>
                    </div>
                  </a>

                  {project.githubUrl && (
                    <a 
                      href={project.githubUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="app-github-badge"
                      title="View GitHub Repository"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="github-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      <span>GitHub</span>
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
        
        <section className="socials-section">
          <h2>Connect with me</h2>
          <div className="socials-links">
            <a 
              href="https://github.com/GianUwU" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link social-github"
            >
              💻 GitHub
            </a>
            <a 
              href="https://www.youtube.com/@ggentertainment2737" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link social-youtube"
            >
              🎥 YouTube
            </a>
            <a 
              href="https://www.instagram.com/therealgian2/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="social-link social-instagram"
            >
              📸 Instagram
            </a>
            <a 
              href="mailto:gian@gaudi.ch" 
              className="social-link social-email"
            >
              ✉️ gian@gaudi.ch
            </a>
          </div>
        </section>

        <footer className="page-footer">
          <p>All pages built by Gian with the help of GitHub Copilot and Gemini</p>
        </footer>
      </div>
    </div>
  )
}

export default App



