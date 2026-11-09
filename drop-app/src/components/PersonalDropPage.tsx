import { useState, useEffect, useRef, useCallback } from 'react'
import { formatFileSize, getAppUrl, isImage, getUploadUrl } from '../utils/fileUtils'
import type { DroppedFile, ActiveUploadItem } from '../types'
import './PersonalDropPage.css'

interface PersonalDropPageProps {
  token: string
}

export default function PersonalDropPage({ token }: PersonalDropPageProps) {
  const [loading, setLoading] = useState<boolean>(true)
  const [validLink, setValidLink] = useState<boolean>(true)
  const [depositedFiles, setDepositedFiles] = useState<DroppedFile[]>([])
  const [activeUploads, setActiveUploads] = useState<ActiveUploadItem[]>([])
  const [isWindowDragging, setIsWindowDragging] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const dragCounterRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const trayScrollRef = useRef<HTMLDivElement>(null)

  // Fetch link info and public dropped file ledger
  const fetchDropLinkData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/drop-link/${token}`)
      if (!res.ok) {
        if (res.status === 404) {
          setValidLink(false)
          return
        }
        throw new Error(`Failed to load drop link (${res.status})`)
      }

      const data = await res.json()
      setValidLink(true)
      setDepositedFiles(data.files || [])
    } catch (err) {
      console.error('Error fetching drop link:', err)
      setValidLink(false)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchDropLinkData()
  }, [fetchDropLinkData])

  // Upload a single file with individual real-time progress and duration calculation
  const uploadSingleFile = useCallback((file: File, uploadId: string) => {
    const startTime = performance.now()
    const formData = new FormData()
    formData.append('files', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.min(Math.round((e.loaded / e.total) * 100), 99)
        const now = performance.now()
        const elapsedSeconds = (now - startTime) / 1000

        let speed = 0
        let remainingSeconds: number | null = null

        if (elapsedSeconds > 0.1 && e.loaded > 0) {
          speed = e.loaded / elapsedSeconds
          const remainingBytes = e.total - e.loaded
          if (speed > 0) {
            remainingSeconds = Math.max(0, Math.ceil(remainingBytes / speed))
          }
        }

        setActiveUploads((prev) =>
          prev.map((item) => {
            if (item.id === uploadId) {
              return {
                ...item,
                progress: percent,
                uploadedBytes: e.loaded,
                speedBytesPerSec: speed,
                estimatedSecondsRemaining: remainingSeconds,
              }
            }
            return item
          })
        )
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText)
          const saved: DroppedFile | undefined = res.files && res.files[0]

          setActiveUploads((prev) =>
            prev.map((item) => {
              if (item.id === uploadId) {
                return {
                  ...item,
                  progress: 100,
                  status: 'completed',
                  estimatedSecondsRemaining: 0,
                  savedFile: saved,
                }
              }
              return item
            })
          )

          if (saved) {
            setDepositedFiles((prev) => {
              if (prev.some((f) => f.id === saved.id)) return prev
              return [saved, ...prev]
            })
          }

          // Remove completed upload item from activeUploads so each file only appears once
          setActiveUploads((prev) => prev.filter((item) => item.id !== uploadId))

          // Auto-scroll tray to beginning to highlight the newly deposited file
          if (trayScrollRef.current) {
            trayScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' })
          }
        } catch {
          setActiveUploads((prev) => prev.filter((item) => item.id !== uploadId))
        }
      } else {
        let msg = `Upload failed (${xhr.status})`
        try {
          const parsed = JSON.parse(xhr.responseText)
          if (parsed.detail) msg = parsed.detail
        } catch {
          // fallback msg
        }
        setActiveUploads((prev) =>
          prev.map((item) => (item.id === uploadId ? { ...item, status: 'error', errorMessage: msg } : item))
        )
      }
    })

    xhr.addEventListener('error', () => {
      setActiveUploads((prev) =>
        prev.map((item) =>
          item.id === uploadId
            ? { ...item, status: 'error', errorMessage: 'Network connection lost during upload.' }
            : item
        )
      )
    })

    xhr.open('POST', `/api/drop-link/${token}/upload`)
    xhr.send(formData)
  }, [token])

  // Handle incoming files (via drop, file picker, or clipboard)
  const handleFilesChosen = useCallback((incomingFiles: FileList | File[]) => {
    const fileArray = Array.from(incomingFiles).filter((f) => f.size > 0 || f.type !== '')
    if (fileArray.length === 0) return

    const newUploadItems: ActiveUploadItem[] = fileArray.map((file) => {
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      return {
        id: uploadId,
        file,
        original_filename: file.name,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        progress: 0,
        status: 'uploading',
        uploadedBytes: 0,
        speedBytesPerSec: 0,
        estimatedSecondsRemaining: null,
      }
    })

    setActiveUploads((prev) => [...newUploadItems, ...prev])
    setStatusMessage(`Uploading ${fileArray.length} file${fileArray.length > 1 ? 's' : ''}...`)
    setTimeout(() => setStatusMessage(null), 4000)

    // Launch uploads
    newUploadItems.forEach((uploadItem) => {
      uploadSingleFile(uploadItem.file, uploadItem.id)
    })

    // Scroll tray to show active uploads
    if (trayScrollRef.current) {
      trayScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' })
    }
  }, [uploadSingleFile])

  // Global Drag and Drop event handlers
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current += 1
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        setIsWindowDragging(true)
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current -= 1
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0
        setIsWindowDragging(false)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsWindowDragging(false)

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesChosen(e.dataTransfer.files)
      }
    }

    const handlePaste = (e: ClipboardEvent) => {
      const clipboardData = e.clipboardData
      if (!clipboardData) return

      const pastedFiles: File[] = []
      if (clipboardData.items) {
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i]
          if (item.kind === 'file') {
            const file = item.getAsFile()
            if (file) {
              if (file.name === 'image.png' || file.name === 'blob' || !file.name) {
                const ext = file.type.split('/')[1]?.replace('+xml', '') || 'png'
                const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)
                const renamed = new File([file], `drop_pasted_${timestamp}.${ext}`, { type: file.type })
                pastedFiles.push(renamed)
              } else {
                pastedFiles.push(file)
              }
            }
          }
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault()
        handleFilesChosen(pastedFiles)
      }
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('paste', handlePaste)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('paste', handlePaste)
    }
  }, [handleFilesChosen])

  // Helper for formatting estimated remaining upload time
  const formatEstimatedTime = (seconds: number | null, speedBytesPerSec: number): string => {
    if (seconds === null || seconds < 0) {
      return 'Calculating time...'
    }
    const speedStr = speedBytesPerSec > 0 ? `${formatFileSize(speedBytesPerSec)}/s` : ''
    let timeStr = ''
    if (seconds === 0) {
      timeStr = 'Almost done'
    } else if (seconds < 60) {
      timeStr = `~${seconds}s left`
    } else {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      timeStr = `~${mins}m ${secs}s left`
    }

    return speedStr ? `${timeStr} • ${speedStr}` : timeStr
  }

  // Helper to get generic file icon
  const getFileIcon = (filename: string, fileType?: string): string => {
    const ext = filename.split('.').pop()?.toUpperCase() || ''
    if (ext === 'PDF' || fileType?.includes('pdf')) return '📕'
    if (fileType?.startsWith('video/') || ['MP4', 'MOV', 'MKV', 'WEBM'].includes(ext)) return '🎬'
    if (fileType?.startsWith('audio/') || ['MP3', 'WAV', 'FLAC', 'M4A'].includes(ext)) return '🎵'
    if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) return '📦'
    if (['TXT', 'MD', 'JSON', 'JS', 'TS', 'PY', 'HTML', 'CSS', 'CSV'].includes(ext)) return '📄'
    return '📁'
  }


  if (loading) {
    return (
      <div className="personal-drop-loading-screen">
        <div className="spinner"></div>
        <p>Connecting to Personal Drop Link...</p>
      </div>
    )
  }

  if (!validLink) {
    return (
      <div className="personal-drop-invalid-screen">
        <div className="invalid-card">
          <div className="invalid-icon">🚫</div>
          <h2>Drop Link Not Found</h2>
          <p>This personal drop link does not exist, has been revoked, or is no longer accepting files.</p>
          <a href={getAppUrl('/')} className="back-home-btn">
            Go to Gian Drop Home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="personal-drop-viewport" id="personal-drop-container">
      {/* Top Brand Bar */}
      <header className="personal-drop-topbar">
        <div className="topbar-brand">
          <span className="brand-icon">📦</span>
          <span className="brand-name">Gian Drop</span>
        </div>
      </header>

      {/* Main Full-Page Drag & Drop Zone */}
      <main
        className="personal-drop-hero"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drag and drop files anywhere or click to browse"
      >
        <div className="drop-target-card">
          <div className="drop-cloud-icon-wrapper">
            <svg
              className="drop-cloud-svg"
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m8 16 4-4 4 4" />
            </svg>
          </div>

          <h1 className="drop-title">Drop files anywhere to send</h1>

          <button
            type="button"
            className="browse-files-btn"
            id="browse-files-button"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            📂 Select Files from Device
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          id="guest-file-input"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesChosen(e.target.files)
              e.target.value = ''
            }
          }}
        />
      </main>

      {/* Full-Screen Drag-Active Overlay */}
      {isWindowDragging && (
        <div className="fullscreen-drag-overlay" id="fullscreen-drag-overlay">
          <div className="drag-overlay-inner">
            <div className="pulsing-drop-icon">📥</div>
            <h2>Release files to drop directly</h2>
            <p>Multiple files supported</p>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {statusMessage && (
        <div className="drop-toast" id="drop-status-toast">
          {statusMessage}
        </div>
      )}

      {/* Persistent Upload Tray (Anchored at Bottom of Screen) */}
      <aside className="persistent-upload-tray" id="persistent-upload-tray" aria-label="Deposited files ledger">
        <div className="tray-header">
          <div className="tray-header-left">
            <span className="tray-title">Deposited Files</span>
            <span className="tray-counter" id="tray-files-counter">
              {depositedFiles.length + activeUploads.filter((u) => u.status === 'uploading').length}
            </span>
          </div>
          <div className="tray-header-right">
            {activeUploads.some((u) => u.status === 'uploading') && (
              <span className="tray-active-indicator">
                <span className="indicator-pulse"></span>
                Uploading...
              </span>
            )}
          </div>
        </div>

        {/* Horizontal Scrollable Track */}
        <div className="tray-track" ref={trayScrollRef} id="tray-files-list">
          {/* Active Upload Items */}
          {activeUploads
            .filter((item) => item.status === 'uploading' || item.status === 'error')
            .map((item) => {
              const isImg = isImage(item.original_filename, item.file_type)
              const objectUrl = isImg ? URL.createObjectURL(item.file) : null
              const ext = item.original_filename.split('.').pop()?.toUpperCase() || 'FILE'

              return (
                <div
                  key={item.id}
                  className={`tray-card active-upload-card ${item.status === 'error' ? 'upload-error' : ''}`}
                  id={`upload-item-${item.id}`}
                >
                  <div className="tray-card-preview">
                    {isImg && objectUrl ? (
                      <img src={objectUrl} alt={item.original_filename} className="tray-thumbnail" />
                    ) : (
                      <div className="tray-icon-fallback">
                        <span className="icon-emoji">{getFileIcon(item.original_filename, item.file_type)}</span>
                        <span className="icon-ext">{ext}</span>
                      </div>
                    )}
                  </div>

                  <div className="tray-card-content">
                    <div className="tray-filename" title={item.original_filename}>
                      {item.original_filename}
                    </div>
                    <div className="tray-meta">
                      <span className="tray-filesize">{formatFileSize(item.file_size)}</span>
                    </div>

                    {item.status === 'uploading' && (
                      <div className="tray-upload-progress">
                        <div className="tray-progress-bar-container">
                          <div
                            className="tray-progress-bar-fill"
                            style={{ width: `${Math.max(item.progress, 5)}%` }}
                          ></div>
                        </div>
                        <div className="tray-upload-duration" title="Upload speed and estimated time remaining">
                          <span className="progress-percent">{item.progress}%</span>
                          <span className="duration-text">
                            ⏱️ {formatEstimatedTime(item.estimatedSecondsRemaining, item.speedBytesPerSec)}
                          </span>
                        </div>
                      </div>
                    )}

                    {item.status === 'error' && (
                      <div className="tray-status-error" title={item.errorMessage}>
                        <span>⚠️ {item.errorMessage || 'Failed'}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

          {/* Deposited Files (Read-only status receipt, no download or view) */}
          {depositedFiles.map((file) => {
            const isImg = isImage(file.original_filename, file.file_type)
            const ext = file.original_filename.split('.').pop()?.toUpperCase() || 'FILE'

            return (
              <div
                key={file.id}
                className="tray-card deposited-file-card"
                id={`deposited-file-${file.id}`}
              >
                <div className="tray-card-preview">
                  {isImg ? (
                    <img
                      src={getUploadUrl(file.filename)}
                      alt={file.original_filename}
                      className="tray-thumbnail"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          const fallback = parent.querySelector('.tray-icon-fallback') as HTMLElement | null
                          if (fallback) fallback.style.display = 'flex'
                        }
                      }}
                    />
                  ) : null}
                  <div className="tray-icon-fallback" style={{ display: isImg ? 'none' : 'flex' }}>
                    <span className="icon-emoji">{getFileIcon(file.original_filename, file.file_type)}</span>
                    <span className="icon-ext">{ext}</span>
                  </div>
                </div>

                <div className="tray-card-content">
                  <div className="tray-filename" title={file.original_filename}>
                    {file.original_filename}
                  </div>
                  <div className="tray-meta">
                    <span className="tray-filesize">{formatFileSize(file.file_size)}</span>
                  </div>
                  <div className="tray-deposited-badge">
                    <span className="deposited-check">✓</span>
                    <span>Deposited</span>
                  </div>
                </div>
              </div>
            )
          })}

          {depositedFiles.length === 0 && activeUploads.filter((u) => u.status === 'uploading').length === 0 && (
            <div className="tray-empty-state">
              <span>📭 No files dropped to this link yet. Tap Select Files or drop files to start!</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
