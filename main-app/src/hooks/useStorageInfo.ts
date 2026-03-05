/**
 * Custom hook for managing storage information
 */

import { useState, useEffect } from 'react'
import type { StorageInfo } from '../types'

export const useStorageInfo = () => {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)

  const loadStorageInfo = async () => {
    try {
      const res = await fetch('/api/storage-info')
      const data = await res.json()
      setStorageInfo(data)
    } catch (e) {
      console.error('Failed to load storage info', e)
    }
  }

  useEffect(() => {
    loadStorageInfo()
  }, [])

  return { storageInfo, reloadStorageInfo: loadStorageInfo }
}
