import './App.css'
import { useState, useEffect, useRef } from 'react'

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1469029741540675861/FeNERCGDfB-GndbHW3Y2nt5jfWg0dRbN98R80lI_JRfd6a-zIbSH2l9IRBAOnIUgwCW5'

const flowersImage = new URL('./assets/flowers.png', import.meta.url).href
const goodImage = new URL('./assets/good.png', import.meta.url).href
const usImage = new URL('./assets/us.png', import.meta.url).href

// Images from pleasepictures folder - add your images here
const IMAGES = [
  new URL('./assets/pleasepictures/adorable-pleading.png', import.meta.url).href,
  new URL('./assets/pleasepictures/anime-cry.gif', import.meta.url).href,
  new URL('./assets/pleasepictures/anime-girl-with-sad-expression-her-face-generative-ai_958124-30567.avif', import.meta.url).href,
  new URL('./assets/pleasepictures/anime-girl.gif', import.meta.url).href,
  new URL('./assets/pleasepictures/anime-little-girl-crying-before-600w-233136934.webp', import.meta.url).href,
  new URL('./assets/pleasepictures/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI1LTA4L3NyLWltYWdlLTE5MDcyMDI1LW1lLTExLXMtMzU3LXBvc3Rlci1tZXNoM2FneS5qcGc.webp', import.meta.url).href,
  new URL('./assets/pleasepictures/crying-girl-anime.gif', import.meta.url).href,
  new URL('./assets/pleasepictures/crying-sad-face.gif', import.meta.url).href,
  new URL('./assets/pleasepictures/images (1).jpeg', import.meta.url).href,
  new URL('./assets/pleasepictures/images.jpeg', import.meta.url).href,
  new URL('./assets/pleasepictures/kaoruko-moeta-comic-girls.gif', import.meta.url).href,
  new URL('./assets/pleasepictures/sad-anime-boy-sad-eyes.gif', import.meta.url).href,
]

const LOVE_CONFESSIONS = [
  'Du siehst einfach fantastisch aus in jedem Outfit, ich schwöre sogar, ich verliere meine Confidence, wenn ich mit dir bin QwQ',
  'Dein Lächeln kann sogar die traurigsten Tage erhellen <3',
  '💝 Jedes Mal, wenn wir uns versöhnen, fühlt es sich an, als würde mein Herz wieder fliegen können',
  'Du bist nicht nur meine grösste Liebe, aber auch absolut meine größte Inspiration. Du bist fantastisch!',
  '💖 Mit dir kann man die tollsten Dinge erleben. Wenn du planst, kann ich mir sicher sein, dass alles gut wird',
  'ICH LIEBE DICH SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SO SEHR <3',
  '😍 Ich bin verliebt in jeden Teil von dir, #OBSESSED hihihihihihihihihihihihihihihihiihihihiihihhiih <3',
  '🎀 Du bist meine stärkste Königin und meine schönste Prinzessin. Ich will dein Ritter und König sein bis zum Ende unserer Tage',
  '💗 Bei dir fühle ich mich zuhause',
  'Schöner als jeder Blumenstrauss, den du mir je schenken könntest, ist ein Bild von dir.',
  'Du tanzt so gut, dass ich mir manchmal echt nicht sicher bin, ob es dich wirklich gibt oder ob du ein Teufel bist, der vom Himmel gefallen ist, um mich zu verführen <3',
]

function getRandomImage() {
  return IMAGES[Math.floor(Math.random() * IMAGES.length)]
}

function App() {
  const [timeElapsed, setTimeElapsed] = useState({
    years: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })
  const [showModal, setShowModal] = useState(false)
  const [confirmLevel, setConfirmLevel] = useState(0) // 0 = not in confirm flow, 1+ = number of "really"s to show
  const [randomImage, setRandomImage] = useState('')
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [currentConfession, setCurrentConfession] = useState('')
  const [showMemoryGame, setShowMemoryGame] = useState(false)
  const [memoryCards, setMemoryCards] = useState<{ id: number; image: string; flipped: boolean; matched: boolean }[]>([])
  const [flippedCards, setFlippedCards] = useState<number[]>([])
  const [matches, setMatches] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Memory game images (will be populated from assets/memory folder)
  const MEMORY_IMAGES = [
    new URL('./assets/memory/1.jpeg', import.meta.url).href,
    new URL('./assets/memory/2.jpeg', import.meta.url).href,
    new URL('./assets/memory/3.jpeg', import.meta.url).href,
    new URL('./assets/memory/4.jpeg', import.meta.url).href,
    new URL('./assets/memory/5.jpeg', import.meta.url).href,
    new URL('./assets/memory/6.jpeg', import.meta.url).href,
  ]

  // Load images from assets/pics
  useEffect(() => {
    setRandomImage(getRandomImage())
  }, [])

  // Sync audio state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handlePlay = () => setAudioPlaying(true)
    const handlePause = () => setAudioPlaying(false)

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [])

  // Add floating hearts on click anywhere on the page
  useEffect(() => {
    const handlePageClick = (e: MouseEvent) => {
      // Create 5 hearts that fly away in different directions
      for (let i = 0; i < 5; i++) {
        const heart = document.createElement('div')
        heart.className = 'floating-heart'
        heart.textContent = '💗'
        heart.style.left = (e.clientX - 12) + 'px'
        heart.style.top = (e.clientY - 12) + 'px'
        
        // Random angle for each heart
        const angle = (i / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
        const distance = 80 + Math.random() * 40
        const tx = Math.cos(angle) * distance
        const ty = Math.sin(angle) * distance
        
        // Random duration for each heart
        const duration = 1.2 + Math.random() * 1.3
        
        heart.style.setProperty('--tx', `${tx}px`)
        heart.style.setProperty('--ty', `${ty}px`)
        heart.style.animationDuration = `${duration}s`
        
        document.body.appendChild(heart)

        setTimeout(() => {
          heart.remove()
        }, duration * 1000)
      }
    }

    document.addEventListener('click', handlePageClick)
    return () => document.removeEventListener('click', handlePageClick)
  }, [])
  const createFireworks = () => {
    const colors = ['#ff1493', '#ff69b4', '#ffb6c1', '#ffc0cb', '#ffd700', '#ff4500', '#ff0000', '#00ff00', '#00ffff', '#ffff00', '#ff00ff', '#ff69b4']
    
    const burst = () => {
      for (let i = 0; i < 100; i++) {
        const firework = document.createElement('div')
        firework.className = 'firework'
        firework.style.left = Math.random() * 100 + '%'
        firework.style.top = Math.random() * 100 + '%'
        firework.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
        
        const angle = (i / 100) * Math.PI * 2
        const velocity = 8 + Math.random() * 12
        const tx = Math.cos(angle) * velocity * 80
        const ty = Math.sin(angle) * velocity * 80
        
        firework.style.setProperty('--tx', `${tx}px`)
        firework.style.setProperty('--ty', `${ty}px`)
        firework.style.animation = `explode ${1.5 + Math.random() * 1}s ease-out forwards`
        document.body.appendChild(firework)

        setTimeout(() => {
          firework.remove()
        }, 2500)
      }
    }
    
    // Burst multiple times
    for (let i = 0; i < 10; i++) {
      setTimeout(burst, i * 200)
    }
  }

  // Load images from assets/pics
  useEffect(() => {
    setRandomImage(getRandomImage())
  }, [])

  // Create falling petals
  useEffect(() => {
    const createPetal = () => {
      const petal = document.createElement('div')
      petal.className = 'petal'
      petal.style.left = Math.random() * 100 + '%'
      petal.style.top = '-20px'
      petal.style.animationName = 'fall'
      petal.style.animationDuration = (Math.random() * 5 + 8) + 's'
      petal.style.animationTimingFunction = 'linear'
      petal.style.animationFillMode = 'forwards'
      document.body.appendChild(petal)

      setTimeout(() => {
        petal.remove()
      }, (Math.random() * 5 + 8) * 1000)
    }

    const interval = setInterval(createPetal, 50)
    return () => clearInterval(interval)
  }, [])

  // Calculate time elapsed since 4.12.2022 at 22:10
  useEffect(() => {
    const calculateTimeElapsed = () => {
      const startDate = new Date('2022-12-04T22:10:00')
      const now = new Date()
      let diff = now.getTime() - startDate.getTime()

      const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
      diff -= years * (1000 * 60 * 60 * 24 * 365.25)

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      diff -= days * (1000 * 60 * 60 * 24)

      const hours = Math.floor(diff / (1000 * 60 * 60))
      diff -= hours * (1000 * 60 * 60)

      const minutes = Math.floor(diff / (1000 * 60))
      diff -= minutes * (1000 * 60)

      const seconds = Math.floor(diff / 1000)

      setTimeElapsed({ years, days, hours, minutes, seconds })
    }

    calculateTimeElapsed()
    const interval = setInterval(calculateTimeElapsed, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleNoClick = () => {
    setShowModal(true)
    setConfirmLevel(1)
    setRandomImage(getRandomImage())
  }

  const handleConfirmNo = () => {
    setShowModal(false)
    setConfirmLevel(0)
  }

  const handleConfirmYes = () => {
    setShowModal(true)
    setConfirmLevel(confirmLevel + 1)
    setRandomImage(getRandomImage())
  }

  const handleConfessionClick = () => {
    const newConfession = LOVE_CONFESSIONS[Math.floor(Math.random() * LOVE_CONFESSIONS.length)]
    setCurrentConfession(newConfession)
  }

  const sendDiscordNotification = async (message: string) => {
    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          embeds: [{
            color: 16711680,
            title: '❤️ Flavia said YES! ❤️',
            description: message,
            timestamp: new Date().toISOString()
          }]
        })
      })
    } catch (error) {
      console.error('Failed to send Discord notification:', error)
    }
  }

  const getPromptText = () => {
    if (confirmLevel === 0) return ''
    return 'Bist du dir ' + 'wirklich '.repeat(confirmLevel) + 'sicher?'
  }

  const initializeMemoryGame = () => {
    const shuffledCards = [...MEMORY_IMAGES, ...MEMORY_IMAGES]
      .sort(() => Math.random() - 0.5)
      .map((image, index) => ({
        id: index,
        image,
        flipped: false,
        matched: false,
      }))
    setMemoryCards(shuffledCards)
    setFlippedCards([])
    setMatches(0)
  }

  const handleCardClick = (cardId: number) => {
    if (flippedCards.length >= 2 || memoryCards[cardId].matched || flippedCards.includes(cardId)) return

    const newFlipped = [...flippedCards, cardId]
    setFlippedCards(newFlipped)

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped
      if (memoryCards[first].image === memoryCards[second].image) {
        setMemoryCards(prev =>
          prev.map(card =>
            card.id === first || card.id === second ? { ...card, matched: true } : card
          )
        )
        setMatches(matches + 1)
        setFlippedCards([])
      } else {
        setTimeout(() => setFlippedCards([]), 1000)
      }
    }
  }

  return (
    <div className="app-container">
      <audio loop ref={audioRef}>
        <source src={new URL('./assets/music.mp3', import.meta.url).href} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>

      {/* Music Control Button */}
      <button 
        className="music-control-btn"
        onClick={() => {
          if (audioRef.current) {
            if (audioRef.current.paused) {
              audioRef.current.play().catch(() => {})
              setAudioPlaying(true)
            } else {
              audioRef.current.pause()
              setAudioPlaying(false)
            }
          }
        }}
        title={audioPlaying ? "Pause music" : "Play music"}
      >
        <span className="heart-container">
          ❤️
          <span className="play-pause-symbol">{audioPlaying ? '⏸' : '▶'}</span>
        </span>
      </button>

      <div className="header-with-images">
        <img src={flowersImage} alt="Left decoration" className="header-image left" />
        <div className="header-content">
          <h1>
            <span className="dear">Liebe</span> <span className="placeholder">Flavia</span>
          </h1>
          <p>
            Meine kleine <span className="valentine">Prinzessin</span>
          </p>
        </div>
        <img src={flowersImage} alt="Right decoration" className="header-image right" />
      </div>

      {/* Time Elapsed Section */}
      <div className="time-section">
        <h2>Wir sind schon zusammen seit</h2>
        <p className="time-display">
          {timeElapsed.years} Jahren {timeElapsed.days} Tagen {timeElapsed.hours} Stunden {timeElapsed.minutes} Minuten und {' '}
          {timeElapsed.seconds} Sekunden
        </p>
      </div>

      {/* Image Carousel Section */}
      {/* Carousel removed */}

      {/* Poem Section */}
      <div className="poem-section">
        <h2>Und meine Liebe für dich wächst jeden Tag nur noch mehr ❤️❤️❤️</h2>
        <p>Rosen sind rot,
        deine Beine sind mein,
        liebe Flavia…</p>
      </div>

      {/* Us Image Section */}
      <img src={usImage} alt="Us" className="us-image" />

      {/* Love Confession Section */}
      <div className="confession-section">
        <button className="confession-btn" onClick={handleConfessionClick}>
          💕
        </button>
        {currentConfession && (
          <div className="confession-message">
            {currentConfession}
          </div>
        )}
      </div>

      {/* Quiz Section */}
      <div className="quiz-section">
        <h2>Willst du mein Valentin sein?</h2>
        <div className="quiz-buttons">
          <button 
            className="quiz-btn no-btn" 
            onClick={handleNoClick}
          >
            NÖ
          </button>
          <button 
            className="quiz-btn yes-btn" 
            onClick={() => {
              createFireworks()
              sendDiscordNotification('Flavia said YES to being my Valentine! 💕')
              setShowModal(true)
              setConfirmLevel(0)
              setRandomImage(getRandomImage())
              setShowMemoryGame(true)
              initializeMemoryGame()
            }}
          >
            JA!
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            {confirmLevel === 0 && (
              <div className="modal-yay">
                <img src={goodImage} alt="Good" className="modal-image" />
                <h1>YAY!!❤️❤️❤️❤️❤️</h1>
                <button 
                  className="modal-btn close-btn"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              </div>
            )}

            {confirmLevel > 0 && (
              <div className="modal-confirm">
                <img src={randomImage} alt="Confirmation" className="modal-image" />
                <h2>{getPromptText()}</h2>
                <div className="modal-buttons">
                  <button 
                    className="modal-btn no-btn"
                    onClick={handleConfirmYes}
                  >
                    ja
                  </button>
                  <button 
                    className="modal-btn yes-btn"
                    onClick={handleConfirmNo}
                  >
                    NÖ!
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Memory Game Section */}
      {showMemoryGame && (
        <div className="memory-game-section">
          <div className="memory-header">
            <h2>Memory Spiel (Deine Stärke)</h2>
            <p>Matches: {matches} / {MEMORY_IMAGES.length}</p>
            <button 
              className="memory-reset-btn"
              onClick={() => initializeMemoryGame()}
            >
              Nochmals!
            </button>
          </div>
          <div className="memory-grid">
            {memoryCards.map(card => (
              <div
                key={card.id}
                className={`memory-card ${card.flipped || card.matched || flippedCards.includes(card.id) ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`}
                onClick={() => handleCardClick(card.id)}
              >
                <div className="memory-card-inner">
                  <div className="memory-card-front">❓</div>
                  <div className="memory-card-back">
                    <img src={card.image} alt="memory" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {matches === MEMORY_IMAGES.length && (
            <div className="memory-complete">
              <h2>🎉 Du hast gewonnen! 🎉</h2>
              <p>Du bist halt einfach die Beste! xD ❤️</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
