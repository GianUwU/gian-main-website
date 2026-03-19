/**
 * Custom hook for managing file list with pagination
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { FileInfo, ViewMode } from '../types'

export const useFileList = () => {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [allLoaded, setAllLoaded] = useState(false)
  const [showMyFiles, setShowMyFiles] = useState(false)
  const [showAllFiles, setShowAllFiles] = useState(false)
  const displayedFilesRef = useRef(new Set<string>())
  const limit = 15

  const loadFiles = useCallback(async (viewMode: ViewMode = 'public') => {
    if (loading || allLoaded) return
    setLoading(true)

    try {
      let endpoint = `/files?offset=${offset}&limit=${limit}`
      if (viewMode === 'my') {
        endpoint = `/files/my?offset=${offset}&limit=${limit}`
      } else if (viewMode === 'all') {
        endpoint = `/files/all?offset=${offset}&limit=${limit}`
      }

      const res = await fetch(endpoint, { credentials: 'include' })
      const fetchedFiles: FileInfo[] = await res.json()

      if (fetchedFiles.length === 0) {
        setAllLoaded(true)
        return
      }

      const newFiles = fetchedFiles.filter(file => !displayedFilesRef.current.has(file.id))
      newFiles.forEach(file => displayedFilesRef.current.add(file.id))

      setFiles(prev => [...prev, ...newFiles])
      setOffset(prev => prev + fetchedFiles.length)
    } catch (e) {
      console.error('Error loading files:', e)
    } finally {
      setLoading(false)
    }
  }, [loading, allLoaded, offset])

  const switchView = useCallback((viewMode: ViewMode) => {
    setFiles([])
    setOffset(0)
    setAllLoaded(false)
    displayedFilesRef.current.clear()
    setShowMyFiles(viewMode === 'my')
    setShowAllFiles(viewMode === 'all')
    setTimeout(() => loadFiles(viewMode), 0)
  }, [loadFiles])

  const addFile = useCallback((file: FileInfo) => {
    setFiles(prev => [file, ...prev])
    displayedFilesRef.current.add(file.id)
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    displayedFilesRef.current.delete(fileId)
  }, [])

  const getCurrentViewMode = useCallback((): ViewMode => {
    return showMyFiles ? 'my' : (showAllFiles ? 'all' : 'public')
  }, [showMyFiles, showAllFiles])

  useEffect(() => {
    loadFiles(getCurrentViewMode())
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
        loadFiles(getCurrentViewMode())
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loading, allLoaded, getCurrentViewMode, loadFiles])

  return {
    files,
    loading,
    showMyFiles,
    showAllFiles,
    switchView,
    addFile,
    removeFile,
    getCurrentViewMode
  }
}
