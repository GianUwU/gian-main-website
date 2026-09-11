/**
 * Custom hook for managing file list with pagination
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWithTokenRefresh } from '../utils/fetchWithTokenRefresh'
import type { FileInfo, ViewMode } from '../types'

export const useFileList = () => {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [allLoaded, setAllLoaded] = useState(false)
  const [showMyFiles, setShowMyFiles] = useState(false)
  const [showAllFiles, setShowAllFiles] = useState(false)
  
  const displayedFilesRef = useRef(new Set<string>())
  const offsetRef = useRef(0)
  const loadingRef = useRef(false)
  const allLoadedRef = useRef(false)
  const currentViewRef = useRef<ViewMode>('public')
  const limit = 15

  const fetchFilesForView = useCallback(async (viewMode: ViewMode, reset: boolean = false) => {
    if (loadingRef.current) return
    if (!reset && allLoadedRef.current) return

    loadingRef.current = true
    setLoading(true)

    if (reset) {
      offsetRef.current = 0
      allLoadedRef.current = false
      setAllLoaded(false)
      displayedFilesRef.current.clear()
    }

    const currentOffset = offsetRef.current

    try {
      let endpoint = `/files?offset=${currentOffset}&limit=${limit}`
      if (viewMode === 'my') {
        endpoint = `/files/my?offset=${currentOffset}&limit=${limit}`
      } else if (viewMode === 'all') {
        endpoint = `/files/all?offset=${currentOffset}&limit=${limit}`
      }

      const res = await fetchWithTokenRefresh(endpoint, { credentials: 'include' })
      if (!res.ok) {
        throw new Error(`Failed to load files (${res.status})`)
      }
      const fetchedFiles: FileInfo[] = await res.json()

      if (fetchedFiles.length === 0) {
        allLoadedRef.current = true
        setAllLoaded(true)
        if (reset) {
          setFiles([])
        }
        return
      }

      if (fetchedFiles.length < limit) {
        allLoadedRef.current = true
        setAllLoaded(true)
      }

      const newFiles = fetchedFiles.filter(file => !displayedFilesRef.current.has(file.id))
      newFiles.forEach(file => displayedFilesRef.current.add(file.id))

      offsetRef.current += fetchedFiles.length

      if (reset) {
        setFiles(newFiles)
      } else {
        setFiles(prev => [...prev, ...newFiles])
      }
    } catch (e) {
      console.error('Error loading files:', e)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [limit])

  const switchView = useCallback((viewMode: ViewMode) => {
    currentViewRef.current = viewMode
    setShowMyFiles(viewMode === 'my')
    setShowAllFiles(viewMode === 'all')
    fetchFilesForView(viewMode, true)
  }, [fetchFilesForView])

  const addFile = useCallback((file: FileInfo) => {
    setFiles(prev => [file, ...prev])
    displayedFilesRef.current.add(file.id)
  }, [])

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
    displayedFilesRef.current.delete(fileId)
  }, [])

  const getCurrentViewMode = useCallback((): ViewMode => {
    return currentViewRef.current
  }, [])

  useEffect(() => {
    fetchFilesForView('public', true)
  }, [fetchFilesForView])

  useEffect(() => {
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 150) {
        if (!loadingRef.current && !allLoadedRef.current) {
          fetchFilesForView(currentViewRef.current, false)
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [fetchFilesForView])

  return {
    files,
    loading,
    allLoaded,
    showMyFiles,
    showAllFiles,
    switchView,
    addFile,
    removeFile,
    getCurrentViewMode
  }
}

