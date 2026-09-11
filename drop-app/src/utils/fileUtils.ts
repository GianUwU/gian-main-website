/**
 * Utility functions for file operations
 */

export const isImage = (filename?: string | null, mimeType?: string | null): boolean => {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('image/')) {
    return true
  }
  if (!filename) return false
  return !!filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg|avif|ico|tiff|tif|heic|heif|apng)$/i)
}

export const isVideo = (filename?: string | null, mimeType?: string | null): boolean => {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/')) {
    return true
  }
  if (!filename) return false
  return !!filename.toLowerCase().match(/\.(mp4|webm|ogg|ogv|mov|m4v|mkv|avi|flv|wmv|3gp|ts)$/i)
}

export const isAudio = (filename?: string | null, mimeType?: string | null): boolean => {
  if (typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('audio/')) {
    return true
  }
  if (!filename) return false
  return !!filename.toLowerCase().match(/\.(mp3|wav|ogg|oga|m4a|aac|flac|wma|opus|mid|midi)$/i)
}

export const isPdf = (filename?: string | null, mimeType?: string | null): boolean => {
  if (typeof mimeType === 'string' && mimeType.toLowerCase() === 'application/pdf') {
    return true
  }
  if (!filename) return false
  return !!filename.toLowerCase().match(/\.pdf$/i)
}

export const isSubtitle = (filename?: string | null): boolean => {
  if (!filename) return false
  return !!filename.toLowerCase().match(/\.(srt|vtt)$/i)
}

export const isSrt = (filename: string): boolean => {
  return filename.toLowerCase().endsWith('.srt')
}

export const isVtt = (filename: string): boolean => {
  return filename.toLowerCase().endsWith('.vtt')
}

export const isTextOrCode = (filename?: string | null, mimeType?: string | null): boolean => {
  if (typeof mimeType === 'string') {
    const lower = mimeType.toLowerCase()
    if (lower.startsWith('text/') || lower === 'application/json' || lower === 'application/javascript' || lower === 'application/xml') {
      return true
    }
  }
  if (!filename) return false
  return !!filename.toLowerCase().match(/\.(txt|text|md|markdown|json|js|jsx|ts|tsx|py|html|htm|css|scss|sass|less|sh|bash|zsh|yaml|yml|xml|csv|log|c|cpp|h|hpp|rs|go|java|sql|env|ini|conf|toml|srt|vtt)$/i)
}

export const isArchive = (filename?: string | null): boolean => {
  if (!filename) return false
  return !!filename.toLowerCase().match(/\.(zip|rar|7z|tar|gz|bz2|xz|tgz|iso)$/i)
}

export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'other'

export const getFileCategory = (filename?: string | null, mimeType?: string | null): FileCategory => {
  if (isImage(filename, mimeType)) return 'image'
  if (isVideo(filename, mimeType)) return 'video'
  if (isAudio(filename, mimeType)) return 'audio'
  if (isPdf(filename, mimeType)) return 'pdf'
  if (isTextOrCode(filename, mimeType)) return 'text'
  if (isArchive(filename)) return 'archive'
  return 'other'
}

const getBaseName = (filename: string): string => {
  return filename.replace(/\.[^/.]+$/, '').toLowerCase()
}

export const findMatchingSubtitleFilename = (
  videoOriginalFilename: string,
  files: { original_filename: string; filename: string }[]
): string | null => {
  const subtitleFiles = files.filter(file => isSubtitle(file.original_filename))
  if (subtitleFiles.length === 0) {
    return null
  }

  const videoBase = getBaseName(videoOriginalFilename)
  const exactMatch = subtitleFiles.find(file => getBaseName(file.original_filename) === videoBase)
  if (exactMatch) {
    return exactMatch.filename
  }

  const languageSuffixMatch = subtitleFiles.find(file => {
    const subtitleBase = getBaseName(file.original_filename)
    const match = subtitleBase.match(new RegExp(`^${videoBase}\\.([a-z]{2,3})([-_][a-z]{2})?$`, 'i'))
    return Boolean(match)
  })

  if (languageSuffixMatch) {
    return languageSuffixMatch.filename
  }

  if (subtitleFiles.length === 1) {
    return subtitleFiles[0].filename
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

