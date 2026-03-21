/**
 * Custom hook for managing file upload state and operations
 */

import { useState, useCallback } from 'react'
import { useAuth } from '../AuthContext'
import { getCookie } from '../utils/cookies'
import type { FileInfo } from '../types'

interface UseFileUploadResult {
  selectedFiles: File[]
  description: string
  isPrivate: boolean
  expirationDays: number | null
  status: string
  uploading: boolean
  uploadProgress: number
  isDragging: boolean
  linkCopied: boolean
  setSelectedFiles: (files: File[]) => void
  setDescription: (description: string) => void
  setIsPrivate: (isPrivate: boolean) => void
  setExpirationDays: (days: number | null) => void
  setStatus: (status: string) => void
  setLinkCopied: (copied: boolean) => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void
  handleSubmit: (e: React.FormEvent, onSuccess?: (file: FileInfo) => void) => Promise<void>
  removeFile: (index: number) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB

export const useFileUpload = (): UseFileUploadResult => {
  const { isAuthenticated, isAdmin, refreshToken } = useAuth()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [description, setDescription] = useState<string>('')
  const [isPrivate, setIsPrivate] = useState<boolean>(false)
  const [expirationDays, setExpirationDays] = useState<number | null>(7)
  const [status, setStatus] = useState<string>('')
  const [uploading, setUploading] = useState<boolean>(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [linkCopied, setLinkCopied] = useState<boolean>(false)

  const validateFiles = useCallback((files: File[]): { valid: boolean; error?: string } => {
    const tooLarge = files.find(file => file.size > MAX_FILE_SIZE)
    if (tooLarge) {
      return {
        valid: false,
        error: `Error: File "${tooLarge.name}" is too large. Maximum file size is 5GB.`
      }
    }
    return { valid: true }
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      const validation = validateFiles(newFiles)
      
      if (!validation.valid) {
        setStatus(validation.error!)
        e.target.value = ''
        return
      }
      
      setSelectedFiles(prev => [...prev, ...newFiles])
      setStatus('')
      e.target.value = ''
    }
  }, [validateFiles])

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (uploading) return

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      const files = Array.from(droppedFiles).filter(file => {
        return file.size > 0 || file.type !== ''
      })
      
      if (files.length === 0) {
        setStatus('Error: Cannot upload folders. Please select files only.')
        return
      }
      
      const validation = validateFiles(files)
      if (!validation.valid) {
        setStatus(validation.error!)
        return
      }
      
      setSelectedFiles(prev => [...prev, ...files])
      setStatus('')
    }
  }, [uploading, validateFiles])

  const handleSubmit = useCallback(async (
    e: React.FormEvent,
    onSuccess?: (file: FileInfo) => void
  ) => {
    e.preventDefault()

    if (!isAuthenticated) {
      setStatus('Please login to upload files')
      window.location.href = '/login'
      return
    }

    if (selectedFiles.length === 0) {
      setStatus('Please select at least one file!')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setStatus('')

    const formData = new FormData()
    selectedFiles.forEach(file => {
      formData.append('files', file)
    })
    formData.append('description', description)
    formData.append('is_private', isPrivate.toString())
    if (expirationDays !== null) {
      formData.append('expiration_days', expirationDays.toString())
    }

    try {
      const uploadWithToken = (authToken: string | null) => new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(percentComplete)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response)
          } else {
            const error = new Error(`Upload failed with status ${xhr.status}`) as Error & { status?: number; response?: unknown }
            error.status = xhr.status
            error.response = xhr.response
            reject(error)
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'))
        })

        xhr.open('POST', '/upload')
        xhr.responseType = 'json'
        xhr.withCredentials = true
        if (authToken) {
          xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
        }
        xhr.send(formData)
      })

      let response: unknown
      try {
        response = await uploadWithToken(getCookie('authToken'))
      } catch (err) {
        const status = (err as { status?: number })?.status
        if (status === 401 || status === 403) {
          await refreshToken()
          response = await uploadWithToken(getCookie('authToken'))
        } else {
          throw err
        }
      }

      const result = response as any

      if (result && result.status === 'ok') {
        setSelectedFiles([])
        setDescription('')
        setIsPrivate(false)
        setExpirationDays(isAdmin ? null : 7)

        if (onSuccess && !result.file.is_private) {
          onSuccess(result.file)
        }

        const fileLink = `${window.location.origin}/view/${result.file.id}`
        const fileCount = result.file.total_files || 1
        const successMsg = fileCount > 1 ? `${fileCount} files uploaded!` : 'Upload successful!'
        setStatus(`success:${fileLink}:${successMsg}`)
      } else {
        setStatus(`Error: ${result?.detail || 'Something went wrong'}`)
      }
    } catch (err) {
      console.error(err)
      setStatus('Upload failed. Check console for details.')
      setUploadProgress(0)
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }, [isAuthenticated, isAdmin, refreshToken, selectedFiles, description, isPrivate, expirationDays])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setStatus('')
  }, [])

  return {
    selectedFiles,
    description,
    isPrivate,
    expirationDays,
    status,
    uploading,
    uploadProgress,
    isDragging,
    linkCopied,
    setSelectedFiles,
    setDescription,
    setIsPrivate,
    setExpirationDays,
    setStatus,
    setLinkCopied,
    handleFileChange,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleSubmit,
    removeFile
  }
}
