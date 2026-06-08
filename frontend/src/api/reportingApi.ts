import axios from 'axios'

const api = axios.create({ baseURL: '/api/reporting', timeout: 300000 })

export const reportingApi = {
  getTemplates: () => api.get('/templates'),

  getGaugeRules: () => api.get('/gauge_rules'),

  preview: (file_path: string, sheet_name = 'DISTRACTION') =>
    api.post('/preview', { file_path, sheet_name }),

  run: (params: {
    template_name: string
    root_folder: string
    output_folder: string
    output_filename: string
    selected_folders: string[]
  }) => api.post('/run', params),

  stop: () => api.post('/stop'),

  gazePreview: (params: {
    file_path: string
    protocol: string
    metadata: {
      oem_name?: string
      vehicle?: string
      engineer?: string
      analyst?: string
      track?: string
    }
    category_configs: Record<string, any>
    gauge_rules: Record<string, any>
    micro?: { min_freq: number; max_freq: number; threshold: number }
    source_dir?: string
  }) => api.post('/gaze/preview', params),

  gazeGenerate: (params: {
    files: string[]
    protocol: string
    metadata: {
      oem_name?: string
      vehicle?: string
      engineer?: string
      analyst?: string
      track?: string
    }
    category_configs: Record<string, any>
    gauge_rules: Record<string, any>
    micro?: { min_freq: number; max_freq: number; threshold: number }
    source_dir?: string
  }) => api.post('/gaze/generate', params),

  openFile: (file_path: string) => api.post('/open_file', { file_path }),
}