import { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import BackendStatusIndicator from './BackendStatusIndicator'
import { formatFileSize, formatDate, formatExpiresIn, isImage } from '../utils/fileUtils'
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

  useEffect(() => {
    loadFileDetails()
  }, [fileId])

  const loadFileDetails = async () => {
    try {
      const response = await fetch(`/api/files/${fileId}`)
      
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
        setBatch(data)
        setSelectedFile(data.files[0]) // Select first file by default
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
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        const count = batch ? batch.files.length : 1
        setDeleteStatus(`${count} file${count > 1 ? 's' : ''} deleted successfully`)
        setTimeout(() => {
          window.location.href = '/'
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
          <a href="/" className="back-link">← Back to Home</a>
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
          <a href="/" className="back-link">← Back to Home</a>
          {firstFile.is_private && (
            <span className="private-badge">🔒 Private</span>
          )}
        </div>

        <div className="file-detail-card">
          {/* Left side - File preview */}
          <div className="file-detail-preview">
            {isImage(displayFile.filename) ? (
              <img src={`/uploads/${displayFile.filename}`} alt={displayFile.original_filename} />
            ) : (
              <div className="file-icon-large">
                <div className="icon">📄</div>
                <div className="extension">
                  {displayFile.original_filename.split('.').pop()?.toUpperCase()}
                </div>
              </div>
            )}
            <div className="preview-filename">{displayFile.original_filename}</div>
            <div className="preview-filesize">{formatFileSize(displayFile.file_size)}</div>
            <button 
              onClick={() => window.location.href = `/api/files/${displayFile.id}/now`}
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
                        {isImage(f.filename) ? '🖼️' : '📄'}
                      </span>
                      <div className="file-info-compact">
                        <span className="file-name-compact">{f.original_filename}</span>
                        <span className="file-size-compact">{formatFileSize(f.file_size)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        window.location.href = `/api/files/${f.id}/now`
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
                      window.location.href = `/api/files/${f.id}/now`
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
        
        <BackendStatusIndicator />
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
        <a href="/" className="back-link">← Back to Home</a>
        {file.is_private && (
          <span className="private-badge">🔒 Private</span>
        )}
      </div>

      <div className="file-detail-card">
        <div className="file-detail-preview">
          {isImage(file.filename) ? (
            <img src={`/uploads/${file.filename}`} alt={file.original_filename} />
          ) : (
            <div className="file-icon-large">
              <div className="icon">📄</div>
              <div className="extension">
                {file.original_filename.split('.').pop()?.toUpperCase()}
              </div>
            </div>
          )}
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
              onClick={() => window.location.href = `/api/files/${file.id}/now`}
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
      
      <BackendStatusIndicator />
    </div>
  )
}

export default FileDetail
