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
  isSrt,
  findMatchingSubtitleFilename,
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
  const [subtitleTrackUrl, setSubtitleTrackUrl] = useState<string | null>(null)
  const [subtitleFilename, setSubtitleFilename] = useState<string | null>(null)
  const [subtitleLoading, setSubtitleLoading] = useState(false)

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

        const srtContent = await response.text()
        const vttContent = srtToVtt(srtContent)
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
        setSelectedFile(sortedFiles[0]) // Select first file by default
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
      const fileId = file ? file.id : batch!.files[0].id
      const response = await fetch(`/files/${fileId}`, {
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

  const renderFilePreview = (previewFile: FileInfo, batchFiles?: FileInfo[]) => {
    if (isImage(previewFile.filename)) {
      return <img src={getUploadUrl(previewFile.filename)} alt={previewFile.original_filename} />
    }

    if (isVideo(previewFile.original_filename, previewFile.file_type)) {
      const canUseBatchSubtitles = Boolean(batchFiles)

      return (
        <div className="media-preview-wrapper">
          <video
            key={previewFile.id}
            controls
            className="media-preview-video"
            preload="metadata"
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

    if (isAudio(previewFile.original_filename, previewFile.file_type)) {
      return (
        <div className="media-preview-wrapper">
          <div className="file-icon-large audio-icon-large">
            <div className="icon">🎵</div>
          </div>
          <audio controls className="media-preview-audio" preload="metadata">
            <source src={getUploadUrl(previewFile.filename)} type={previewFile.file_type || undefined} />
            Your browser does not support audio playback.
          </audio>
        </div>
      )
    }

    return (
      <div className="file-icon-large">
        <div className="icon">📄</div>
        <div className="extension">
          {previewFile.original_filename.split('.').pop()?.toUpperCase()}
        </div>
      </div>
    )
  }

  const getBatchFileIcon = (batchFile: FileInfo) => {
    if (isImage(batchFile.filename)) {
      return '🖼️'
    }

    if (isVideo(batchFile.original_filename, batchFile.file_type)) {
      return '🎬'
    }

    if (isAudio(batchFile.original_filename, batchFile.file_type)) {
      return '🎵'
    }

    if (isSrt(batchFile.original_filename)) {
      return '💬'
    }

    return '📄'
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

  // Render batch view if this is a batch upload
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
              onClick={() => window.location.href = `/files/${displayFile.id}/now`}
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
                        window.location.href = `/files/${f.id}/now`
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
                onClick={() => {
                  batch.files.forEach((f, index) => {
                    setTimeout(() => {
                      window.location.href = `/files/${f.id}/now`
                    }, index * 100)
                  })
                }}
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
              onClick={() => window.location.href = `/files/${file.id}/now`}
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
