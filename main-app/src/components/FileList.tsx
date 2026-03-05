/**
 * FileList component - displays the list of files with pagination
 */

import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { formatFileSize, formatExpiresIn, isImage } from '../utils/fileUtils'
import type { FileInfo } from '../types'

interface FileListProps {
  files: FileInfo[]
  loading: boolean
  showMyFiles: boolean
  showAllFiles: boolean
  onSwitchView: (view: 'public' | 'my' | 'all') => void
  onDeleteFile: (fileId: string) => void
}

export default function FileList({
  files,
  loading,
  showMyFiles,
  showAllFiles,
  onSwitchView,
  onDeleteFile
}: FileListProps) {
  const { isAuthenticated, username, isAdmin } = useAuth()
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; totalFiles?: number | null } | null>(null)

  const handleDeleteClick = (fileId: string, fileName: string, totalFiles?: number | null) => {
    setDeleteConfirm({ id: fileId, name: fileName, totalFiles: totalFiles || null })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      const response = await fetch(`/api/files/${deleteConfirm.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        onDeleteFile(deleteConfirm.id)
        setDeleteConfirm(null)
      } else {
        const result = await response.json()
        console.error('Delete failed:', result.detail)
        setDeleteConfirm(null)
      }
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleteConfirm(null)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirm(null)
  }

  return (
    <>
      <div className="gallery-section">
        <div className="gallery-header">
          <h2>
            {showMyFiles ? 'My Files' : showAllFiles ? 'All Files (Admin)' : 'Public Files'}
          </h2>
          {isAuthenticated && (
            <div className="view-controls">
              <button 
                className={`view-btn ${!showMyFiles && !showAllFiles ? 'active' : ''}`}
                onClick={() => onSwitchView('public')}
              >
                🌐 Public
              </button>
              <button 
                className={`view-btn ${showMyFiles ? 'active' : ''}`}
                onClick={() => onSwitchView('my')}
              >
                📁 My Files
              </button>
              {isAdmin && (
                <button 
                  className={`view-btn ${showAllFiles ? 'active' : ''}`}
                  onClick={() => onSwitchView('all')}
                >
                  👑 All Files
                </button>
              )}
            </div>
          )}
        </div>

        <div className="file-list">
          {files.length === 0 && !loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No files uploaded yet.</div>
          ) : (
            files.map(file => (
              <div key={file.id} className="file-card">
                <a href={`/view/${file.id}`} className="file-preview-link">
                  <div className="file-preview">
                    {file.total_files && file.total_files > 1 ? (
                      <div className="file-icon batch-icon">
                        📁
                        <div style={{ fontSize: '14px', marginTop: '5px', fontWeight: 'bold' }}>
                          {file.total_files} files
                        </div>
                      </div>
                    ) : isImage(file.filename) ? (
                      <img src={`/uploads/${file.filename}`} alt={file.original_filename} />
                    ) : (
                      <div className="file-icon">
                        📄
                        <div style={{ fontSize: '12px', marginTop: '5px' }}>
                          {file.original_filename.split('.').pop()?.toUpperCase()}
                        </div>
                      </div>
                    )}
                  </div>
                </a>
                <div className="file-info">
                  <a href={`/view/${file.id}`} className="file-name-link">
                    {file.description ? (
                      <div className="file-name" title={file.description}>
                        {file.description.length > 60 ? `${file.description.substring(0, 60)}...` : file.description}
                      </div>
                    ) : (
                      <div className="file-name">{file.original_filename}</div>
                    )}
                  </a>
                  <div className="file-original-name">
                    {file.total_files && file.total_files > 1 ? (
                      `📁 ${file.total_files} files`
                    ) : (
                      file.original_filename
                    )}
                  </div>
                  <div className="file-meta">
                    <span className="file-user">👤 {file.username}</span>
                    <span className="file-size">{formatFileSize(file.total_size || file.file_size)}</span>
                  </div>
                  {file.expires_at && (
                    <div className="file-expires">
                      ⏱️ {formatExpiresIn(file.expires_at)}
                    </div>
                  )}
                  <div className="file-actions">
                    <a 
                      href={`/uploads/${file.filename}`} 
                      download={file.original_filename}
                      className="btn-download"
                      onClick={(e) => e.stopPropagation()}
                    >
                      ⬇️ Download
                    </a>
                    {isAuthenticated && (file.username === username || isAdmin) && (
                      <button 
                        onClick={() => handleDeleteClick(file.id, file.original_filename, file.total_files)}
                        className="btn-delete"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>}
        </div>
      </div>

      {deleteConfirm && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {deleteConfirm.totalFiles && deleteConfirm.totalFiles > 1 ? (
              <p>Are you sure you want to delete <strong>all {deleteConfirm.totalFiles} files</strong> in this batch?</p>
            ) : (
              <p>Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?</p>
            )}
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
    </>
  )
}
