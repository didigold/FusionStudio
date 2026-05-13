import axios from 'axios'

const api = axios.create({
  baseURL: '/api/fuse',
  timeout: 120000,
})

export const fuseApi = {
  scan: (source_dir: string) => api.post('/scan', { source_dir }),
  signals: (file_path: string) => api.post('/signals', { file_path }),
  run: (params: {
    source_dir: string
    participants: string[]
    signal_whitelist?: [string, number, number][] | null
    copy_videos: boolean
    overwrite_mode: boolean
  }) => api.post('/run', params),
  pause: () => api.post('/pause'),
  resume: () => api.post('/resume'),
  stop: () => api.post('/stop'),
}