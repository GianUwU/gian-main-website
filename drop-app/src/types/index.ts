/**
 * Shared TypeScript types for the main application
 */

export interface FileInfo {
  id: string
  filename: string
  original_filename: string
  description: string
  username: string
  user_id: number
  uploaded_at: string
  file_size: number
  file_type: string
  is_private: boolean
  expires_at: string | null
  batch_id: string | null
  file_path?: string | null
  total_files: number | null
  total_size: number | null
}

export interface BatchInfo {
  is_batch: boolean
  batch_id: string
  files: FileInfo[]
}

export interface StorageInfo {
  used_gb: number
  max_gb: number
  percentage: number
  is_full: boolean
}

export type ViewMode = 'public' | 'my' | 'all'
