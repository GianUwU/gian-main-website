/**
 * FileUpload component - handles file selection and upload
 */

import { useAuth } from '../AuthContext'
import { useStorageInfo } from '../hooks/useStorageInfo'
import { useFileUpload } from '../hooks/useFileUpload'
import { formatFileSize } from '../utils/fileUtils'
import type { FileInfo } from '../types'

interface FileUploadProps {
  onUploadSuccess?: (file: FileInfo) => void
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const { isAuthenticated, isAdmin } = useAuth()
  const { storageInfo } = useStorageInfo()
  const {
    selectedFiles,
    description,
    isPrivate,
    expirationDays,
    status,
    uploading,
    uploadProgress,
    isDragging,
    linkCopied,
    setDescription,
    setIsPrivate,
    setExpirationDays,
    setLinkCopied,
    handleFileChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleSubmit,
    removeFile
  } = useFileUpload()

  return (
    <div className="upload-card">
      <h2>Upload a File</h2>
      
      {storageInfo && (
        <div className="storage-info">
          <div className="storage-bar">
            <div 
              className={`storage-fill ${storageInfo.is_full ? 'full' : ''}`}
              style={{ width: `${Math.min(storageInfo.percentage, 100)}%` }}
            ></div>
          </div>
          <div className="storage-text">
            {storageInfo.is_full ? (
              <span className="storage-full">⚠️ Storage Full: {storageInfo.used_gb}GB / {storageInfo.max_gb}GB</span>
            ) : (
              <span>Storage: {storageInfo.used_gb}GB / {storageInfo.max_gb}GB ({storageInfo.percentage}%)</span>
            )}
          </div>
        </div>
      )}

      {isAuthenticated ? (
        <form onSubmit={(e) => handleSubmit(e, onUploadSuccess)} className="upload-form">
          <div 
            className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${selectedFiles.length > 0 ? 'has-files' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => !uploading && document.getElementById('file-input')?.click()}
          >
            {selectedFiles.length > 0 ? (
              <>
                <div className="files-list-compact">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="file-item-compact">
                      <span className="file-icon-tiny">
                        {file.type.startsWith('image/') ? '🖼️' : '📄'}
                      </span>
                      <div className="file-info-inline">
                        <span className="file-name-inline">{file.name}</span>
                        <span className="file-size-inline">{formatFileSize(file.size)}</span>
                      </div>
                      {!uploading && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(index)
                          }}
                          className="remove-file-btn-compact"
                          type="button"
                          title="Remove file"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!uploading && (
                  <div className="add-more-area">
                    <span className="add-more-text">+ Click or drag to add more files</span>
                  </div>
                )}
              </>
            ) : (
              <div className="drop-zone-empty">
                <div className="upload-icon-large">📁</div>
                <div className="drop-zone-text">
                  <strong>Drag & drop files here or click to browse</strong>
                  <span>Multiple files supported</span>
                </div>
              </div>
            )}
          </div>

          <input 
            id="file-input"
            type="file" 
            onChange={handleFileChange}
            disabled={uploading}
            multiple
            style={{ display: 'none' }}
          />

          <textarea
            placeholder="Add a description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={uploading}
          />

          <label className="private-checkbox-label">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              disabled={uploading}
            />
            <span>
              🔒 Make private (only accessible via direct link)
            </span>
          </label>

          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#213547', display: 'block', marginBottom: '8px' }}>
              ⏱️ Auto-delete after:
            </label>
            <div className="expiration-options">
              <button
                type="button"
                className={`expiration-btn ${expirationDays === 1 ? 'active' : ''}`}
                onClick={() => setExpirationDays(1)}
                disabled={uploading}
              >
                1 Day
              </button>
              <button
                type="button"
                className={`expiration-btn ${expirationDays === 7 ? 'active' : ''}`}
                onClick={() => setExpirationDays(7)}
                disabled={uploading}
              >
                1 Week
              </button>
              <button
                type="button"
                className={`expiration-btn ${expirationDays === 30 ? 'active' : ''}`}
                onClick={() => setExpirationDays(30)}
                disabled={uploading}
              >
                1 Month
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className={`expiration-btn ${expirationDays === null ? 'active' : ''}`}
                  onClick={() => setExpirationDays(null)}
                  disabled={uploading}
                >
                  Never
                </button>
              )}
            </div>
          </div>
          
          {uploading && (
            <div className="upload-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="progress-text">Uploading... {uploadProgress}%</div>
            </div>
          )}
          
          <button type="submit" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          <p>Please <a href="/login" style={{ color: '#667eea', fontWeight: '600' }}>login</a> to upload files</p>
        </div>
      )}

      {status && (
        <div className="status">
          {status.startsWith('success:') ? (
            <div className="success-message">
              <span>✅ {status.substring(status.lastIndexOf(':') + 1) || 'Upload successful!'}</span>
              <button 
                className="copy-link-btn"
                onClick={() => {
                  const parts = status.split('success:')[1]
                  const link = parts.substring(0, parts.lastIndexOf(':'))
                  navigator.clipboard.writeText(link)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 3000)
                }}
              >
                📋 Click to Copy Link
              </button>
              {linkCopied && (
                <div className="link-copied-message">
                  ✅ Link copied to clipboard!
                </div>
              )}
              <a 
                href={(() => {
                  const parts = status.split('success:')[1]
                  return parts.substring(0, parts.lastIndexOf(':'))
                })()}
                className="view-link-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                👁️ View Files
              </a>
            </div>
          ) : (
            <span>{status}</span>
          )}
        </div>
      )}
    </div>
  )
}
