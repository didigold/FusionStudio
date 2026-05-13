import axios from 'axios'

const api = axios.create({ baseURL: '/api/classification', timeout: 120000 })

export const classificationApi = {
  scan: (source_dir: string) => api.post('/scan', { source_dir }),

  generateName: (params: {
    case_key: string
    attempt: number
    occ_code?: string | null
    year?: string
    oem?: string
    ref_code?: string
    protocol?: string
  }) => api.post('/generate-names', params),

  run: (params: {
    tasks: any[]
    project_root: string
    meta: Record<string, string>
    report_pdf_path: string
  }) => api.post('/run', params),

  stop: () => api.post('/stop'),
}