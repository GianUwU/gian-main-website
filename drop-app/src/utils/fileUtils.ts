/**
 * Utility functions for file operations
 */

export const isImage = (filename: string): boolean => {
  return !!filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/)
}

export const isVideo = (filename: string, mimeType?: string | null): boolean => {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/')) {
    return true
  }

  return !!filename.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/)
}

export const isAudio = (filename: string, mimeType?: string | null): boolean => {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('audio/')) {
    return true
  }

  return !!filename.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)
}

export const isSrt = (filename: string): boolean => {
  return filename.toLowerCase().endsWith('.srt')
}

const getBaseName = (filename: string): string => {
  return filename.replace(/\.[^/.]+$/, '').toLowerCase()
}

export const findMatchingSubtitleFilename = (
  videoOriginalFilename: string,
  files: { original_filename: string; filename: string }[]
): string | null => {
  const srtFiles = files.filter(file => isSrt(file.original_filename))
  if (srtFiles.length === 0) {
    return null
  }

  const videoBase = getBaseName(videoOriginalFilename)
  const exactMatch = srtFiles.find(file => getBaseName(file.original_filename) === videoBase)
  if (exactMatch) {
    return exactMatch.filename
  }

  const languageSuffixMatch = srtFiles.find(file => {
    const subtitleBase = getBaseName(file.original_filename)
    const match = subtitleBase.match(new RegExp(`^${videoBase}\\.([a-z]{2,3})([-_][a-z]{2})?$`, 'i'))
    return Boolean(match)
  })

  if (languageSuffixMatch) {
    return languageSuffixMatch.filename
  }

  if (srtFiles.length === 1) {
    return srtFiles[0].filename
  }

  return null
}

export const getUploadUrl = (filename: string): string => {
  const encodedFilename = encodeURIComponent(filename)
  const uploadsBase = import.meta.env.VITE_DROP_UPLOADS_BASE_URL as string | undefined

  if (uploadsBase && uploadsBase.trim().length > 0) {
    const normalizedUploadsBase = uploadsBase.replace(/\/+$/, '')
    return `${normalizedUploadsBase}/${encodedFilename}`
  }

  const appBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  const prefix = appBase.length > 0 ? appBase : ''
  return `${prefix}/uploads/${encodedFilename}`
}

export const getAppUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const appBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

  if (appBase.length === 0) {
    return normalizedPath
  }

  return `${appBase}${normalizedPath}`
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
