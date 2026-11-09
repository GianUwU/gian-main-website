import { useState, useEffect, useRef, useCallback } from 'react'
import { renderAsync } from 'docx-preview'
import { getUploadUrl } from '../utils/fileUtils'
import type { FileInfo } from '../types'
import './DocxViewer.css'

interface DocxViewerProps {
  file: FileInfo
  downloadUrl?: string
}

export default function DocxViewer({ file, downloadUrl }: DocxViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerHostRef = useRef<HTMLDivElement>(null)

  const effectiveDownloadUrl = downloadUrl || `/files/${file.id}/now`

  const loadDocument = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const docUrl = getUploadUrl(file.filename)
      const res = await fetch(docUrl)
      if (!res.ok) {
        throw new Error(`Failed to download file for preview (HTTP ${res.status})`)
      }

      const blob = await res.blob()

      if (!viewerHostRef.current) return

      // Clear existing content
      viewerHostRef.current.innerHTML = ''

      await renderAsync(blob, viewerHostRef.current, undefined, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        renderHeaders: true,
        renderFooters: true,
        renderFootnotes: true,
        renderEndnotes: true,
        useBase64URL: true,
      })

      setLoading(false)
    } catch (err: unknown) {
      console.error('Error rendering docx:', err)
      const message = err instanceof Error ? err.message : 'Failed to render DOCX preview.'
      setError(message)
      setLoading(false)
    }
  }, [file.filename])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isFullscreen])

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 15, 200))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 15, 50))
  }

  const handleResetZoom = () => {
    setZoom(100)
  }

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev)
  }

  return (
    <div
      ref={containerRef}
      className={`docx-viewer-container ${isFullscreen ? 'docx-viewer-fullscreen' : ''}`}
    >
      {/* Header Toolbar */}
      <div className="docx-toolbar">
        <div className="docx-toolbar-left">
          <span className="docx-badge">DOCX</span>
          <span className="docx-filename-label" title={file.original_filename}>
            {file.original_filename}
          </span>
        </div>

        <div className="docx-toolbar-right">
          {/* Zoom controls */}
          <div className="docx-btn-group">
            <button
              type="button"
              className="docx-tool-btn"
              onClick={handleZoomOut}
              disabled={loading || zoom <= 50}
              title="Zoom Out"
            >
              −
            </button>
            <span className="docx-zoom-display">{zoom}%</span>
            <button
              type="button"
              className="docx-tool-btn"
              onClick={handleZoomIn}
              disabled={loading || zoom >= 200}
              title="Zoom In"
            >
              +
            </button>
            {zoom !== 100 && (
              <button
                type="button"
                className="docx-tool-btn"
                onClick={handleResetZoom}
                title="Reset Zoom to 100%"
              >
                ↺
              </button>
            )}
          </div>

          {/* Fullscreen toggle */}
          <button
            type="button"
            className={`docx-btn-action ${isFullscreen ? 'docx-btn-fullscreen-active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Full Screen View'}
          >
            {isFullscreen ? '✕ Exit' : '⛶ Expand'}
          </button>

          {/* Direct Download */}
          <a
            href={effectiveDownloadUrl}
            className="docx-btn-action"
            title="Download Document"
          >
            ⬇️ Download
          </a>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="docx-viewport">
        {loading && (
          <div className="docx-loading-state">
            <div className="docx-spinner" />
            <div className="docx-loading-text">Loading Word document preview...</div>
          </div>
        )}

        {error && !loading && (
          <div className="docx-error-state">
            <div className="docx-error-icon">⚠️</div>
            <div className="docx-error-message">{error}</div>
            <div className="docx-error-actions">
              <button type="button" className="docx-btn-retry" onClick={loadDocument}>
                🔄 Retry
              </button>
              <a href={effectiveDownloadUrl} className="docx-btn-download-fallback">
                ⬇️ Download Instead
              </a>
            </div>
          </div>
        )}

        <div
          ref={viewerHostRef}
          className="docx-render-host"
          style={{
            display: loading || error ? 'none' : 'flex',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        />
      </div>
    </div>
  )
}
