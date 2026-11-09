import { useState, useEffect, useCallback } from 'react'
import { fetchWithTokenRefresh } from '../utils/fetchWithTokenRefresh'
import { getAppUrl } from '../utils/fileUtils'

interface PersonalDropLinkBannerProps {
  onLinkUpdated?: (token: string) => void
}

export default function PersonalDropLinkBanner({ onLinkUpdated }: PersonalDropLinkBannerProps) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [copySuccess, setCopySuccess] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmRegenerate, setShowConfirmRegenerate] = useState<boolean>(false)
  const [regenerating, setRegenerating] = useState<boolean>(false)

  const fetchDropLink = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchWithTokenRefresh('/api/drop-link/mine', {
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error(`Failed to load personal drop link (${res.status})`)
      }

      const data = await res.json()
      setToken(data.token)
      if (onLinkUpdated) {
        onLinkUpdated(data.token)
      }
    } catch (err) {
      console.error('Error fetching personal drop link:', err)
      setError('Could not retrieve your personal drop link.')
    } finally {
      setLoading(false)
    }
  }, [onLinkUpdated])

  useEffect(() => {
    fetchDropLink()
  }, [fetchDropLink])

  const fullDropUrl = token
    ? `${window.location.origin}${getAppUrl(`/drop/${token}`)}`
    : ''

  const handleCopy = async () => {
    if (!fullDropUrl) return
    try {
      await navigator.clipboard.writeText(fullDropUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2500)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const handleRegenerate = async () => {
    try {
      setRegenerating(true)
      const res = await fetchWithTokenRefresh('/api/drop-link/mine/regenerate', {
        method: 'POST',
        credentials: 'include'
      })

      if (!res.ok) {
        throw new Error('Failed to regenerate drop link')
      }

      const data = await res.json()
      setToken(data.token)
      setShowConfirmRegenerate(false)
      setCopySuccess(false)
      if (onLinkUpdated) {
        onLinkUpdated(data.token)
      }
    } catch (err) {
      console.error('Regenerate error:', err)
      setError('Failed to regenerate link. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="personal-drop-banner" id="personal-drop-link-section">
      <div className="personal-drop-banner-header">
        <div className="personal-drop-banner-title">
          <span className="banner-icon">📥</span>
          <div>
            <h3>Personal Drop Link</h3>
            <p>
              Anyone with this public link can drop files directly into your personal files without creating an account.
            </p>
          </div>
        </div>
        <span className="banner-badge">🔒 Direct to Personal</span>
      </div>

      {loading ? (
        <div className="banner-loading">Loading your personal drop link...</div>
      ) : error ? (
        <div className="banner-error">
          <span>{error}</span>
          <button onClick={fetchDropLink} className="banner-retry-btn">Retry</button>
        </div>
      ) : (
        <div className="banner-body">
          <div className="drop-link-input-group">
            <input
              type="text"
              readOnly
              value={fullDropUrl}
              className="drop-link-input"
              onClick={(e) => (e.target as HTMLInputElement).select()}
              aria-label="Your personal drop link"
            />
            <div className="drop-link-actions">
              <button
                onClick={handleCopy}
                className={`drop-copy-btn ${copySuccess ? 'copied' : ''}`}
                title="Copy to clipboard"
              >
                {copySuccess ? '✅ Copied!' : '📋 Copy Link'}
              </button>
              <a
                href={fullDropUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="drop-open-btn"
                title="Open drop page in new tab"
              >
                ↗️ Open Page
              </a>
              <button
                onClick={() => setShowConfirmRegenerate(true)}
                className="drop-regenerate-btn"
                title="Reset link to revoke previous link"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          <div className="banner-hint">
            <span>💡 Dropped files are saved as individual, text-free private posts in your personal section.</span>
          </div>
        </div>
      )}

      {showConfirmRegenerate && (
        <div className="modal-overlay" onClick={() => !regenerating && setShowConfirmRegenerate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Personal Drop Link?</h3>
            <p>
              Generating a new link will immediately revoke the current link. Anyone visiting the old link will no longer be able to drop files.
            </p>
            <div className="modal-buttons">
              <button
                className="button button-confirm"
                onClick={handleRegenerate}
                disabled={regenerating}
              >
                {regenerating ? 'Resetting...' : 'Yes, Reset Link'}
              </button>
              <button
                className="button button-cancel"
                onClick={() => setShowConfirmRegenerate(false)}
                disabled={regenerating}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
