import { create } from 'zustand'

type Module = 'fuse' | 'analysis' | 'classification' | 'reporting' | 'om' | 'brain'

interface SystemStats {
  cpu: number
  ram_mb: number
  gpu_util: number
  gpu_vram_mb: number
  gpu_temp: number
}

export interface Participant {
  name: string
  path: string
  status_text: string
  color: string
  masters: string[]
  satellites: string[]
  checked: boolean
  progress: number
  status: string
}

export interface SignalEntry {
  name: string
  count: number | string
  group: string
  g_idx: number
  c_idx: number
  checked: boolean
}

export type FusionState = 'idle' | 'running' | 'paused' | 'stopping'

interface LogEntry {
  ts: number
  message: string
}

interface AppState {
  activeModule: Module
  setActiveModule: (mod: Module) => void
  systemStats: SystemStats | null
  setSystemStats: (stats: SystemStats) => void
  sourcePath: string
  setSourcePath: (path: string) => void

  // Fuse state
  participants: Participant[]
  setParticipants: (p: Participant[]) => void
  toggleParticipant: (name: string) => void
  setAllParticipants: (checked: boolean) => void
  setIncompleteParticipants: () => void
  updateParticipantProgress: (name: string, percent: number) => void
  updateParticipantStatus: (name: string, status: string) => void

  signals: SignalEntry[]
  setSignals: (s: SignalEntry[]) => void
  toggleSignal: (name: string) => void
  setAllSignals: (checked: boolean) => void
  masterFile: string
  setMasterFile: (f: string) => void

  fusionState: FusionState
  setFusionState: (s: FusionState) => void
  globalProgress: number
  setGlobalProgress: (v: number) => void
  cleaningMem: boolean
  setCleaningMem: (v: boolean) => void

  logs: LogEntry[]
  addLog: (message: string) => void
  clearLogs: () => void

  copyVideos: boolean
  setCopyVideos: (v: boolean) => void
  overwriteMode: boolean
  setOverwriteMode: (v: boolean) => void
  signalFilter: string
  setSignalFilter: (f: string) => void

  // Analysis state
  analysisResults: any[]
  analysisSourcePath: string
  setAnalysisSourcePath: (p: string) => void
  setAnalysisResults: (r: any[]) => void
  analysisSelectedFile: string
  setAnalysisSelectedFile: (f: string) => void
  analysisCheckedFiles: string[]
  toggleAnalysisFile: (path: string) => void
  setAllAnalysisFiles: (checked: boolean) => void
  setIncompleteAnalysisFiles: (category: 'tracking' | 'marks' | 'report') => void
  analysisExpandedAll: boolean | null
  setAnalysisExpandedAll: (v: boolean | null) => void
  analysisAvailableCameras: number[]
  setAnalysisAvailableCameras: (c: number[]) => void
  analysisSelectedCamera: number
  setAnalysisSelectedCamera: (c: number) => void
  analysisChannels: any[]
  setAnalysisChannels: (c: any[]) => void
  analysisSignalData: { timestamps: number[]; values: number[]; unit: string; name: string } | null
  setAnalysisSignalData: (d: any) => void
  analysisAudioResult: { peak_frequency?: number; success?: boolean; error?: string } | null
  setAnalysisAudioResult: (r: any) => void
  analysisEventResult: any
  setAnalysisEventResult: (r: any) => void
  analysisChronosRunning: boolean
  setAnalysisChronosRunning: (v: boolean) => void
  analysisChronosProgress: number
  setAnalysisChronosProgress: (v: number) => void
  analysisChronosStats: any
  setAnalysisChronosStats: (s: any) => void

  // Classification state
  classifySourcePath: string
  setClassifySourcePath: (p: string) => void
  classifyOutputPath: string
  setClassifyOutputPath: (p: string) => void
  classifyYear: string
  setClassifyYear: (y: string) => void
  classifyOem: string
  setClassifyOem: (o: string) => void
  classifyRef: string
  setClassifyRef: (r: string) => void
  classifyProtocol: string
  setClassifyProtocol: (p: string) => void
  classifyReportPdf: string
  setClassifyReportPdf: (p: string) => void
  classifyGroups: any[]
  setClassifyGroups: (g: any[]) => void
  classifyToggleFile: (groupIdx: number, fileIdx: number) => void
  classifyProcessing: boolean
  setClassifyProcessing: (v: boolean) => void
  classifyProgress: number
  setClassifyProgress: (v: number) => void
  classifyStatus: string
  setClassifyStatus: (s: string) => void

  // Reporting state
  reportingRootFolder: string
  setReportingRootFolder: (p: string) => void
  reportingOutputFolder: string
  setReportingOutputFolder: (p: string) => void
  reportingFilename: string
  setReportingFilename: (f: string) => void
  reportingTemplate: string
  setReportingTemplate: (t: string) => void
  reportingTemplates: any[]
  setReportingTemplates: (t: any[]) => void
  reportingOptions: Record<string, boolean>
  setReportingOption: (label: string, checked: boolean) => void
  reportingProcessing: boolean
  setReportingProcessing: (v: boolean) => void
  reportingStatus: string
  setReportingStatus: (s: string) => void
  reportingOutputPath: string
  setReportingOutputPath: (p: string) => void
  reportingPreviewData: any
  setReportingPreviewData: (d: any) => void

  // Brain state
  brainProjectsRoot: string
  setBrainProjectsRoot: (p: string) => void
  brainProjects: any[]
  setBrainProjects: (p: any[]) => void
  brainModels: any[]
  setBrainModels: (m: any[]) => void
  brainHistory: any
  setBrainHistory: (h: any) => void
  brainArchitecture: 'multimodal' | 'legacy'
  setBrainArchitecture: (a: 'multimodal' | 'legacy') => void
  brainModelName: string
  setBrainModelName: (n: string) => void
  brainEpochs: number
  setBrainEpochs: (e: number) => void
  brainLR: number
  setBrainLR: (lr: number) => void
  brainPatience: number
  setBrainPatience: (p: number) => void
  brainTraining: boolean
  setBrainTraining: (v: boolean) => void
  brainPhase: string
  setBrainPhase: (p: string) => void
  brainPhaseProgress: number
  setBrainPhaseProgress: (v: number) => void
  brainEpochData: any[]
  addBrainEpochData: (d: any) => void
  clearBrainEpochData: () => void
  brainAnalysisFile: string
  setBrainAnalysisFile: (f: string) => void
  brainAnalysisVideo: string
  setBrainAnalysisVideo: (v: string) => void
  brainAnalysisMarkers: any[]
  setBrainAnalysisMarkers: (m: any[]) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: 'fuse',
  setActiveModule: (mod) => set({ activeModule: mod }),
  systemStats: null,
  setSystemStats: (stats) => set({ systemStats: stats }),
  sourcePath: '',
  setSourcePath: (path) => set({ sourcePath: path }),

  participants: [],
  setParticipants: (p) => set({ participants: p }),
  toggleParticipant: (name) =>
    set((s) => ({
      participants: s.participants.map((pp) =>
        pp.name === name ? { ...pp, checked: !pp.checked } : pp
      ),
    })),
  setAllParticipants: (checked) =>
    set((s) => ({
      participants: s.participants.map((pp) => ({ ...pp, checked })),
    })),
  setIncompleteParticipants: () =>
    set((s) => ({
      participants: s.participants.map((pp) => ({
        ...pp,
        checked: pp.color !== '#2da44e',
      })),
    })),
  updateParticipantProgress: (name, percent) =>
    set((s) => ({
      participants: s.participants.map((pp) =>
        pp.name === name ? { ...pp, progress: percent } : pp
      ),
    })),
  updateParticipantStatus: (name, status) =>
    set((s) => ({
      participants: s.participants.map((pp) =>
        pp.name === name ? { ...pp, status } : pp
      ),
    })),

  signals: [],
  setSignals: (s) => set({ signals: s }),
  toggleSignal: (name) =>
    set((s) => ({
      signals: s.signals.map((sig) =>
        sig.name === name ? { ...sig, checked: !sig.checked } : sig
      ),
    })),
  setAllSignals: (checked) =>
    set((s) => ({
      signals: s.signals.map((sig) =>
        s.signalFilter && !sig.name.toLowerCase().includes(s.signalFilter.toLowerCase())
          ? sig
          : { ...sig, checked }
      ),
    })),
  masterFile: '',
  setMasterFile: (f) => set({ masterFile: f }),

  fusionState: 'idle',
  setFusionState: (s) => set({ fusionState: s }),
  globalProgress: 0,
  setGlobalProgress: (v) => set({ globalProgress: v }),
  cleaningMem: false,
  setCleaningMem: (v) => set({ cleaningMem: v }),

  logs: [],
  addLog: (message) =>
    set((s) => ({ logs: [...s.logs, { ts: Date.now(), message }] })),
  clearLogs: () => set({ logs: [] }),

  copyVideos: false,
  setCopyVideos: (v) => set({ copyVideos: v }),
  overwriteMode: false,
  setOverwriteMode: (v) => set({ overwriteMode: v }),
  signalFilter: '',
  setSignalFilter: (f) => set({ signalFilter: f }),

  // Analysis state
  analysisResults: [],
  analysisSourcePath: '',
  setAnalysisSourcePath: (p: string) => set({ analysisSourcePath: p }),
  setAnalysisResults: (r: any[]) => set({ analysisResults: r }),
  analysisSelectedFile: '',
  setAnalysisSelectedFile: (f: string) => set({ analysisSelectedFile: f }),
  analysisCheckedFiles: [],
  toggleAnalysisFile: (path) =>
    set((s) => ({
      analysisCheckedFiles: s.analysisCheckedFiles.includes(path)
        ? s.analysisCheckedFiles.filter((p) => p !== path)
        : [...s.analysisCheckedFiles, path],
    })),
  setAllAnalysisFiles: (checked) =>
    set((s) => {
      if (!checked) return { analysisCheckedFiles: [] }
      const allFiles: string[] = []
      const collect = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.type === 'file') allFiles.push(n.path)
          if (n.children) collect(n.children)
        }
      }
      collect(s.analysisResults)
      return { analysisCheckedFiles: allFiles }
    }),
  setIncompleteAnalysisFiles: (category) =>
    set((s) => {
      const pending: string[] = []
      const collect = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.type === 'file') {
            const isDone = category === 'tracking' ? n.has_tracking : category === 'marks' ? n.has_marks : n.has_report
            if (!isDone) pending.push(n.path)
          }
          if (n.children) collect(n.children)
        }
      }
      collect(s.analysisResults)
      return { analysisCheckedFiles: pending }
    }),
  analysisExpandedAll: null,
  setAnalysisExpandedAll: (v) => set({ analysisExpandedAll: v }),
  analysisAvailableCameras: [],
  setAnalysisAvailableCameras: (c) => set({ analysisAvailableCameras: c }),
  analysisSelectedCamera: 1,
  setAnalysisSelectedCamera: (c) => set({ analysisSelectedCamera: c }),
  analysisChannels: [],
  setAnalysisChannels: (c: any[]) => set({ analysisChannels: c }),
  analysisSignalData: null as { timestamps: number[]; values: number[]; unit: string; name: string } | null,
  setAnalysisSignalData: (d: any) => set({ analysisSignalData: d }),
  analysisAudioResult: null as { peak_frequency?: number; success?: boolean; error?: string } | null,
  setAnalysisAudioResult: (r: any) => set({ analysisAudioResult: r }),
  analysisEventResult: null as any,
  setAnalysisEventResult: (r: any) => set({ analysisEventResult: r }),
  analysisChronosRunning: false,
  setAnalysisChronosRunning: (v: boolean) => set({ analysisChronosRunning: v }),
  analysisChronosProgress: 0,
  setAnalysisChronosProgress: (v: number) => set({ analysisChronosProgress: v }),
  analysisChronosStats: null as any,
  setAnalysisChronosStats: (s: any) => set({ analysisChronosStats: s }),

  // Classification state
  classifySourcePath: '',
  setClassifySourcePath: (p) => set({ classifySourcePath: p }),
  classifyOutputPath: '',
  setClassifyOutputPath: (p) => set({ classifyOutputPath: p }),
  classifyYear: String(new Date().getFullYear()).slice(-2),
  setClassifyYear: (y) => set({ classifyYear: y }),
  classifyOem: '',
  setClassifyOem: (o) => set({ classifyOem: o }),
  classifyRef: '',
  setClassifyRef: (r) => set({ classifyRef: r }),
  classifyProtocol: 'DSM',
  setClassifyProtocol: (p) => set({ classifyProtocol: p }),
  classifyReportPdf: '',
  setClassifyReportPdf: (p) => set({ classifyReportPdf: p }),
  classifyGroups: [],
  setClassifyGroups: (g) => set({ classifyGroups: g }),
  classifyToggleFile: (groupIdx, fileIdx) =>
    set((s) => {
      const groups = [...s.classifyGroups]
      const files = [...groups[groupIdx].files]
      files[fileIdx] = { ...files[fileIdx], checked: !files[fileIdx].checked }
      groups[groupIdx] = { ...groups[groupIdx], files }
      return { classifyGroups: groups }
    }),
  classifyProcessing: false,
  setClassifyProcessing: (v) => set({ classifyProcessing: v }),
  classifyProgress: 0,
  setClassifyProgress: (v) => set({ classifyProgress: v }),
  classifyStatus: '',
  setClassifyStatus: (s) => set({ classifyStatus: s }),

  // Reporting state
  reportingRootFolder: '',
  setReportingRootFolder: (p) => set({ reportingRootFolder: p }),
  reportingOutputFolder: '',
  setReportingOutputFolder: (p) => set({ reportingOutputFolder: p }),
  reportingFilename: 'Report_Results.xlsx',
  setReportingFilename: (f) => set({ reportingFilename: f }),
  reportingTemplate: '',
  setReportingTemplate: (t) => set({ reportingTemplate: t }),
  reportingTemplates: [],
  setReportingTemplates: (t) => set({ reportingTemplates: t }),
  reportingOptions: {},
  setReportingOption: (label, checked) =>
    set((s) => ({ reportingOptions: { ...s.reportingOptions, [label]: checked } })),
  reportingProcessing: false,
  setReportingProcessing: (v) => set({ reportingProcessing: v }),
  reportingStatus: 'Ready.',
  setReportingStatus: (s) => set({ reportingStatus: s }),
  reportingOutputPath: '',
  setReportingOutputPath: (p) => set({ reportingOutputPath: p }),
  reportingPreviewData: null,
  setReportingPreviewData: (d) => set({ reportingPreviewData: d }),

  // Brain state
  brainProjectsRoot: '',
  setBrainProjectsRoot: (p) => set({ brainProjectsRoot: p }),
  brainProjects: [],
  setBrainProjects: (p) => set({ brainProjects: p }),
  brainModels: [],
  setBrainModels: (m) => set({ brainModels: m }),
  brainHistory: null,
  setBrainHistory: (h) => set({ brainHistory: h }),
  brainArchitecture: 'multimodal',
  setBrainArchitecture: (a) => set({ brainArchitecture: a }),
  brainModelName: 'distraction_detector',
  setBrainModelName: (n) => set({ brainModelName: n }),
  brainEpochs: 100,
  setBrainEpochs: (e) => set({ brainEpochs: e }),
  brainLR: 0.001,
  setBrainLR: (lr) => set({ brainLR: lr }),
  brainPatience: 15,
  setBrainPatience: (p) => set({ brainPatience: p }),
  brainTraining: false,
  setBrainTraining: (v) => set({ brainTraining: v }),
  brainPhase: '',
  setBrainPhase: (p) => set({ brainPhase: p }),
  brainPhaseProgress: 0,
  setBrainPhaseProgress: (v) => set({ brainPhaseProgress: v }),
  brainEpochData: [],
  addBrainEpochData: (d) => set((s) => ({ brainEpochData: [...s.brainEpochData, d] })),
  clearBrainEpochData: () => set({ brainEpochData: [] }),
  brainAnalysisFile: '',
  setBrainAnalysisFile: (f) => set({ brainAnalysisFile: f }),
  brainAnalysisVideo: '',
  setBrainAnalysisVideo: (v) => set({ brainAnalysisVideo: v }),
  brainAnalysisMarkers: [],
  setBrainAnalysisMarkers: (m) => set({ brainAnalysisMarkers: m }),
}))