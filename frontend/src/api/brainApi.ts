import axios from 'axios'

const api = axios.create({ baseURL: '/api/brain', timeout: 600000 })

export const brainApi = {
  listProjects: (root: string) => api.get('/projects', { params: { root } }),

  listModels: () => api.get('/models'),

  getHistory: () => api.get('/history'),

  trainLegacy: (params: {
    root_folders: string[]
    model_name?: string
    epochs?: number
    lr?: number
  }) => api.post('/train/legacy', params),

  trainMultimodal: (params: {
    root_folders: string[]
    model_name?: string
    epochs?: number
    lr?: number
    patience?: number
    camera_config?: Record<string, string>
  }) => api.post('/train/multimodal', params),

  stopTraining: () => api.post('/stop'),

  analyze: (tracking_mf4: string, video_path?: string) =>
    api.post('/analyze', { tracking_mf4, video_path }),
}