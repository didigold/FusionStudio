import axios from 'axios'

const api = axios.create({ baseURL: '/api/om', timeout: 300000 })

export const omApi = {
  omPreview: (params: {
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
    report_camera_settings?: { left: string; right: string }
  }) => api.post('/preview', params),

  omGenerate: (params: {
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
    report_camera_settings?: { left: string; right: string }
  }) => api.post('/generate', params),
}
