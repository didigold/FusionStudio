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
}