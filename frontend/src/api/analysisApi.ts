import axios from 'axios'
import { useAppStore } from '@/store/useAppStore'

const api = axios.create({ baseURL: '/api/analysis', timeout: 120000 })

export const analysisApi = {
  scan: (source_dir: string, marks_path?: string) =>
    api.post('/scan', { source_dir, marks_path }),

  channels: (file_path: string) =>
    api.post('/channels', { file_path }),

  signal: (file_path: string, channel_name: string, max_points = 20000) =>
    api.post('/signal', { file_path, channel_name, max_points }),

  detectAudio: (params: {
    file_path: string
    start_time?: number
    end_time?: number
    min_freq?: number
    max_freq?: number
    signal_name?: string
  }) => api.post('/detect/audio', params),

  detectEvents: (file_path: string, channel_name: string) =>
    api.post('/detect/events', { file_path, channel_name }),

  runChronos: (mf4_paths: string[], camera_id = 0, source_dir = '', gamification_filter = 'none') =>
    api.post('/run/chronos', { mf4_paths, camera_id, source_dir, gamification_filter }),

  updateChronosFilter: (gamification_filter: string) =>
    api.post('/run/chronos/filter', { gamification_filter }),

  stopChronos: () => api.post('/stop/chronos'),

  saveMarks: (file_path: string, marks: number[], source_dir = '') => {
    const promise = api.post('/marks/save', { file_path, source_dir, marks })
    promise.then(() => {
      // Derive the base MF4 path (node.path in the tree is always the non-tracking file)
      const basePath = file_path.replace(/_tracking\.mf4$/i, '.mf4')
      useAppStore.getState().updateFileStatus(basePath, { has_marks: marks.length > 0 })
    }).catch(() => { /* silent */ })
    return promise
  },

  loadMarks: (file_path: string, source_dir = '') =>
    api.post('/marks/load', { file_path, source_dir }),
}