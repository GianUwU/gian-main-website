import { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import {
  formatFileSize,
  formatDate,
  formatExpiresIn,
  getAppUrl,
  getUploadUrl,
  isImage,
  isVideo,
  isAudio,
  isPdf,
  isTextOrCode,
  isSubtitle,
  findMatchingSubtitleFilename,
  getFileCategory,
} from '../utils/fileUtils'
import type { FileInfo, BatchInfo } from '../types'
import '../FileDetail.css'

interface FileDetailProps {
  fileId: string
}

function FileDetail({ fileId }: FileDetailProps) {
  const { isAuthenticated, username, isAdmin } = useAuth()
  const [file, setFile] = useState<FileInfo | null>(null)
  const [batch, setBatch] = useState<BatchInfo | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteStatus, setDeleteStatus] = useState<string>('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string>('')
  
  // Subtitle state
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState<string | null>(null)
  const [subtitleFilename, setSubtitleFilename] = useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = useState(false)

  // Text preview state
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState<string | null>(null)
  const [textCopied, setTextCopied] = useState(false)

  // Image load error state
  const [imageError, setImageError] = useState(false)

  const sortFilesByName = (files: FileInfo[]): FileInfo[] => {
    return [...files].sort((a, b) =>
      a.original_filename.localeCompare(b.original_filename, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    )
  }

  const srtToVtt = (srtContent: string): string => {
    const normalized = srtContent.replace(/\r/g, '').trim()
    if (!normalized) {
      return 'WEBVTT\n\n'
    }

    const convertedTimestamps = normalized.replace(
      /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
      '$1.$2'
    )

    return `WEBVTT\n\n${convertedTimestamps}\n`
  }

  useEffect(() => {
    loadFileDetails()
  }, [fileId])

  const activeDisplayFile = selectedFile || file || (batch ? batch.files[0] : null)

  // Load text/code preview when selected file is text
  useEffect(() => {
    setImageError(false)
    setTextContent(null)
    setTextError(null)

    if (!activeDisplayFile) return

    const isText = isTextOrCode(activeDisplayFile.original_filename, activeDisplayFile.file_type)
    if (!isText) return

    // Limit text fetching to files under 10MB to avoid freezing
    if (activeDisplayFile.file_size > 10 * 1024 * 1024) {
      setTextError('File is too large for in-browser text preview. Please download to view.')
      return
    }

    let isMounted = true
    setTextLoading(true)

    fetch(getUploadUrl(activeDisplayFile.filename))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((text) => {
        if (isMounted) {
          setTextContent(text)
          setTextLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load text preview:', err)
          setTextError('Failed to load text preview.')
          setTextLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [activeDisplayFile?.id, activeDisplayFile?.filename])

  // Subtitle track preparation for video
  useEffect(() => {
    let objectUrlToRevoke: string | null = null
    let isMounted = true

    const prepareSubtitleTrack = async () => {
      setSubtitleTrackUrl(null)
      setSubtitleFilename(null)
      setSubtitleLoading(false)

      if (!batch) {
        return
      }

      const activeFile = selectedFile || batch.files[0]
      if (!activeFile || !isVideo(activeFile.original_filename, activeFile.file_type)) {
        return
      }

      const matchedSubtitleStorageFilename = findMatchingSubtitleFilename(
        activeFile.original_filename,
        batch.files
      )

      if (!matchedSubtitleStorageFilename) {
        return
      }

      const matchedSubtitleFile = batch.files.find(
        f => f.filename === matchedSubtitleStorageFilename
      )

      setSubtitleFilename(matchedSubtitleFile?.original_filename || matchedSubtitleStorageFilename)
      setSubtitleLoading(true)

      try {
        const response = await fetch(getUploadUrl(matchedSubtitleStorageFilename))
        if (!response.ok) {
          throw new Error(`Subtitle fetch failed (${response.status})`)
        }

        const rawContent = await response.text()
        const isAlreadyVtt = isSubtitle(matchedSubtitleFile?.original_filename) && matchedSubtitleFile?.original_filename.toLowerCase().endsWith('.vtt')
        const vttContent = isAlreadyVtt ? rawContent : srtToVtt(rawContent)
        const vttBlob = new Blob([vttContent], { type: 'text/vtt' })
        const vttObjectUrl = URL.createObjectURL(vttBlob)
        objectUrlToRevoke = vttObjectUrl

        if (isMounted) {
          setSubtitleTrackUrl(vttObjectUrl)
        }
      } catch (err) {
        console.error('Failed to prepare subtitles:', err)
        if (isMounted) {
          setSubtitleTrackUrl(null)
        }
      } finally {
        if (isMounted) {
          setSubtitleLoading(false)
        }
      }
    }

    prepareSubtitleTrack()

    return () => {
      isMounted = false
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke)
      }
    }
  }, [batch, selectedFile])

  const loadFileDetails = async () => {
    try {
      const response = await fetch(`/files/${fileId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('File not found')
        } else {
          setError('Error loading file')
        }
        return
      }

      const data = await response.json()
      
      // Check if this is a batch response
      if (data.is_batch) {
        const sortedFiles = sortFilesByName(data.files)
        setBatch({
          ...data,
          files: sortedFiles,
        })
        setSelectedFile(sortedFiles[0])
      } else {
        setFile(data)
      }
    } catch (err) {
      console.error(err)
      setError('Error loading file')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = async () => {
    if (!file && !batch) return

    try {
      const targetId = file ? file.id : batch!.files[0].id
      const response = await fetch(`/files/${targetId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        const count = batch ? batch.files.length : 1
        setDeleteStatus(`${count} file${count > 1 ? 's' : ''} deleted successfully`)
        setTimeout(() => {
          window.location.href = getAppUrl('/')
        }, 1500)
      } else {
        const result = await response.json()
        setDeleteStatus(`Error: ${result.detail || 'Failed to delete file'}`)
      }
    } catch (err) {
      console.error(err)
      setDeleteStatus('Delete failed')
    }
    setShowDeleteModal(false)
  }

  const handleCancelDelete = () => {
    setShowDeleteModal(false)
  }

  const copyLinkToClipboard = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    setCopyStatus('✅ Link copied to clipboard!')
    setTimeout(() => setCopyStatus(''), 3000)
  }

  const triggerDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleBatchDownloadAll = () => {
    if (!batch || batch.files.length === 0) return
    
    batch.files.forEach((f, index) => {
      setTimeout(() => {
        triggerDownload(`/files/${f.id}/now`, f.original_filename)
      }, index * 300)
    })
  }

  const renderFilePreview = (previewFile: FileInfo, batchFiles?: FileInfo[]) => {
    const filename = previewFile.original_filename || previewFile.filename
    const mimeType = previewFile.file_type

    // Image Preview
    if (isImage(filename, mimeType)) {
      if (imageError) {
        return (
          <div className="preview-fallback-box">
            <span className="fallback-icon">🖼️</span>
            <p>Image preview could not be displayed</p>
            <a href={`/files/${previewFile.id}/now`} className="btn-download-preview">
              ⬇️ Download Image
            </a>
          </div>
        )
      }

      return (
        <div className="media-preview-wrapper image-preview-wrapper">
          <img 
            key={previewFile.id}
            src={getUploadUrl(previewFile.filename)} 
            alt={previewFile.original_filename}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </div>
      )
    }

    // Video Preview
    if (isVideo(filename, mimeType)) {
      const canUseBatchSubtitles = Boolean(batchFiles)

      return (
        <div className="media-preview-wrapper">
          <video
            key={previewFile.id}
            controls
            className="media-preview-video"
            preload="metadata"
            playsInline
            onLoadedMetadata={(event) => {
              const trackList = event.currentTarget.textTracks
              if (trackList && trackList.length > 0) {
                trackList[0].mode = 'showing'
              }
            }}
          >
            <source
              key={previewFile.filename}
              src={getUploadUrl(previewFile.filename)}
              type={previewFile.file_type || undefined}
            />
            {canUseBatchSubtitles && subtitleTrackUrl && (
              <track
                key={subtitleTrackUrl}
                kind="captions"
                src={subtitleTrackUrl}
                srcLang="en"
                label="English"
                default
              />
            )}
            Your browser does not support video playback.
          </video>
          {canUseBatchSubtitles && subtitleFilename && subtitleTrackUrl && (
            <div className="media-subtitle-status">
              Subtitles loaded automatically: {subtitleFilename}
            </div>
          )}
          {canUseBatchSubtitles && subtitleFilename && subtitleLoading && (
            <div className="media-subtitle-status">Loading subtitles: {subtitleFilename}</div>
          )}
        </div>
      )
    }

    // Audio Preview
    if (isAudio(filename, mimeType)) {
      return (
        <div className="media-preview-wrapper audio-wrapper">
          <div className="file-icon-large audio-icon-large">
            <div className="icon">🎵</div>
          </div>
          <audio key={previewFile.id} controls className="media-preview-audio" preload="metadata">
            <source src={getUploadUrl(previewFile.filename)} type={previewFile.file_type || undefined} />
            Your browser does not support audio playback.
          </audio>
        </div>
      )
    }

    // PDF Preview
    if (isPdf(filename, mimeType)) {
      return (
        <div className="pdf-preview-container">
          <iframe
            key={previewFile.id}
            src={getUploadUrl(previewFile.filename)}
            title={previewFile.original_filename}
            className="pdf-preview-frame"
          />
        </div>
      )
    }

    // Text / Code Preview
    if (isTextOrCode(filename, mimeType)) {
      return (
        <div className="text-preview-container">
          <div className="text-preview-header">
            <span className="text-preview-label">📄 Text / Code Preview</span>
            {textContent && (
              <button
                type="button"
                className="btn-copy-code"
                onClick={() => {
                  navigator.clipboard.writeText(textContent)
                  setTextCopied(true)
                  setTimeout(() => setTextCopied(false), 2000)
                }}
              >
                {textCopied ? '✅ Copied!' : '📋 Copy Text'}
              </button>
            )}
          </div>
          {textLoading ? (
            <div className="text-preview-loading">Loading text preview...</div>
          ) : textError ? (
            <div className="text-preview-error">{textError}</div>
          ) : (
            <pre className="text-preview-content">
              <code>{textContent}</code>
            </pre>
          )}
        </div>
      )
    }

    // Fallback Generic Icon
    const ext = previewFile.original_filename.split('.').pop()?.toUpperCase() || 'FILE'
    return (
      <div className="file-icon-large">
        <div className="icon">
          {previewFile.file_type?.includes('zip') || previewFile.original_filename.match(/\.(zip|rar|7z|tar|gz)$/i) ? '📦' : '📄'}
        </div>
        <div className="extension">
          {ext}
        </div>
      </div>
    )
  }

  const getBatchFileIcon = (batchFile: FileInfo) => {
    const category = getFileCategory(batchFile.original_filename, batchFile.file_type)
    switch (category) {
      case 'image':
        return '🖼️'
      case 'video':
        return '🎬'
      case 'audio':
        return '🎵'
      case 'pdf':
        return '📕'
      case 'text':
        return isSubtitle(batchFile.original_filename) ? '💬' : '📝'
      case 'archive':
        return '📦'
      default:
        return '📄'
    }
  }

  if (loading) {
    return (
      <div className="file-detail-container">
        <div className="loading">Loading file details...</div>
      </div>
    )
  }

  if (error || (!file && !batch)) {
    return (
      <div className="file-detail-container">
        <div className="error-message">
          <h2>{error || 'File not found'}</h2>
          <a href={getAppUrl('/')} className="back-link">← Back to Home</a>
        </div>
      </div>
    )
  }

  // Render batch view
  if (batch) {
    const totalSize = batch.files.reduce((sum, f) => sum + f.file_size, 0)
    const firstFile = batch.files[0]
    const displayFile = selectedFile || firstFile
    
    return (
      <div className="file-detail-container">
        <div className="file-detail-header">
          <a href={getAppUrl('/')} className="back-link">← Back to Home</a>
          {firstFile.is_private && (
            <span className="private-badge">🔒 Private</span>
          )}
        </div>

        <div className="file-detail-card">
          {/* Left side - File preview */}
          <div className="file-detail-preview">
            {renderFilePreview(displayFile, batch.files)}
            <div className="preview-filename">{displayFile.original_filename}</div>
            <div className="preview-filesize">{formatFileSize(displayFile.file_size)}</div>
            <button 
              onClick={() => triggerDownload(`/files/${displayFile.id}/now`, displayFile.original_filename)}
              className="btn-download-preview"
            >
              ⬇️ Download This File
            </button>
          </div>

          {/* Right side - File list and info */}
          <div className="file-detail-info">
            <div className="batch-header-compact">
              <div className="batch-icon-compact">📁</div>
              <div>
                <h1 className="file-title">Batch Upload</h1>
                <p className="batch-description">
                  {firstFile.description || `${batch.files.length} files uploaded together`}
                </p>
              </div>
            </div>

            <div className="file-metadata">
              <div className="metadata-item">
                <span className="label">Uploaded by:</span>
                <span className="value">👤 {firstFile.username}</span>
              </div>
              <div className="metadata-item">
                <span className="label">Date:</span>
                <span className="value">{formatDate(firstFile.uploaded_at)}</span>
              </div>
              <div className="metadata-item">
                <span className="label">Total Files:</span>
                <span className="value">{batch.files.length}</span>
              </div>
              <div className="metadata-item">
                <span className="label">Total Size:</span>
                <span className="value">{formatFileSize(totalSize)}</span>
              </div>
              {firstFile.expires_at && (
                <div className="metadata-item expiration-warning">
                  <span className="label">⏱️ Expires in:</span>
                  <span className="value expires-value">{formatExpiresIn(firstFile.expires_at)}</span>
                </div>
              )}
            </div>

            <div className="batch-files-section-compact">
              <h3>Files in this batch:</h3>
              <div className="batch-files-list-compact">
                {batch.files.map((f) => (
                  <div 
                    key={f.id} 
                    className={`batch-file-item-compact ${selectedFile?.id === f.id ? 'active' : ''}`}
                  >
                    <div 
                      className="file-click-area"
                      onClick={() => setSelectedFile(f)}
                    >
                      <span className="file-icon-compact">
                        {getBatchFileIcon(f)}
                      </span>
                      <div className="file-info-compact">
                        <span className="file-name-compact">{f.original_filename}</span>
                        <span className="file-size-compact">{formatFileSize(f.file_size)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        triggerDownload(`/files/${f.id}/now`, f.original_filename)
                      }}
                      className="btn-download-tiny"
                      title="Download this file"
                    >
                      ⬇️
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="file-actions-detail">
              <button
                onClick={handleBatchDownloadAll}
                className="btn-download-all"
              >
                📦 Download All Files
              </button>
              
              <button 
                onClick={copyLinkToClipboard}
                className="btn-copy-link"
              >
                🔗 Copy Batch Link
              </button>

              {copyStatus && (
                <div className="copy-status-message">
                  {copyStatus}
                </div>
              )}

              {isAuthenticated && (firstFile.username === username || isAdmin) && (
                <button 
                  onClick={handleDeleteClick}
                  className="btn-delete-large"
                >
                  🗑️ Delete All Files
                </button>
              )}
            </div>

            {deleteStatus && (
              <div className={`status-message ${deleteStatus.includes('Error') ? 'error' : 'success'}`}>
                {deleteStatus}
              </div>
            )}
          </div>
        </div>
        
        {showDeleteModal && (
          <div className="modal-overlay" onClick={handleCancelDelete}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <p>Are you sure you want to delete <strong>all {batch.files.length} files</strong> in this batch?</p>
              <div className="modal-buttons">
                <button className="button button-confirm" onClick={handleConfirmDelete}>
                  Yes
                </button>
                <button className="button button-cancel" onClick={handleCancelDelete}>
                  No
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div>
    )
  }

  // Render single file view
  if (!file) {
    return null
  }

  return (
    <div className="file-detail-container">
      <div className="file-detail-header">
        <a href={getAppUrl('/')} className="back-link">← Back to Home</a>
        {file.is_private && (
          <span className="private-badge">🔒 Private</span>
        )}
      </div>

      <div className="file-detail-card">
        <div className="file-detail-preview">
          {renderFilePreview(file)}
        </div>

        <div className="file-detail-info">
          <h1 className="file-title">{file.original_filename}</h1>
          
          {file.description && (
            <div className="file-description-section">
              <h3>Description</h3>
              <p>{file.description}</p>
            </div>
          )}

          <div className="file-metadata">
            <div className="metadata-item">
              <span className="label">Uploaded by:</span>
              <span className="value">👤 {file.username}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Date:</span>
              <span className="value">{formatDate(file.uploaded_at)}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Size:</span>
              <span className="value">{formatFileSize(file.file_size)}</span>
            </div>
            <div className="metadata-item">
              <span className="label">Type:</span>
              <span className="value">{file.file_type || 'Unknown'}</span>
            </div>
            {file.expires_at && (
              <div className="metadata-item expiration-warning">
                <span className="label">⏱️ Expires in:</span>
                <span className="value expires-value">{formatExpiresIn(file.expires_at)}</span>
              </div>
            )}
          </div>

          <div className="file-actions-detail">
            <button 
              onClick={() => triggerDownload(`/files/${file.id}/now`, file.original_filename)}
              className="btn-download-large"
            >
              ⬇️ Download File
            </button>
            
            <button 
              onClick={copyLinkToClipboard}
              className="btn-copy-link"
            >
              🔗 Copy Link
            </button>

            {copyStatus && (
              <div className="copy-status-message">
                {copyStatus}
              </div>
            )}

            {isAuthenticated && (file.username === username || isAdmin) && (
              <button 
                onClick={handleDeleteClick}
                className="btn-delete-large"
              >
                🗑️ Delete File
              </button>
            )}
          </div>

          {deleteStatus && (
            <div className={`status-message ${deleteStatus.includes('Error') ? 'error' : 'success'}`}>
              {deleteStatus}
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p>Are you sure you want to delete <strong>{file.original_filename}</strong>?</p>
            <div className="modal-buttons">
              <button className="button button-confirm" onClick={handleConfirmDelete}>
                Yes
              </button>
              <button className="button button-cancel" onClick={handleCancelDelete}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  )
}

export default FileDetail

