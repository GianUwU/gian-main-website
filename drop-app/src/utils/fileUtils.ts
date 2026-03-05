/**
 * Utility functions for file operations
 */

export const isImage = (filename: string): boolean => {
  return !!filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/)
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatExpiresIn = (expiresAt: string | null): string | null => {
  if (!expiresAt) return null
  
  const now = new Date()
  const expires = new Date(expiresAt)
  const diffMs = expires.getTime() - now.getTime()
  
  if (diffMs < 0) return 'Expired'
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) return `Expires in ${diffDays} day${diffDays > 1 ? 's' : ''}`
  if (diffHours > 0) return `Expires in ${diffHours} hour${diffHours > 1 ? 's' : ''}`
  return 'Expires soon'
}

export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toUpperCase() || 'FILE'
}
