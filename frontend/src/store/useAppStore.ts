import { create } from 'zustand'
import { toast } from 'sonner'
import { getOmScenarioCategory } from '../lib/utils'

export interface SignalConfig {
  name: string
  checked: boolean
  operator: string
  threshold: number | string
  alias: string
}

export interface PassConfig {
  signal: string
  value1: number
  operator1: string
  value2: number
  operator2: string
  mask: number
}

export interface UnresponsivePhase {
  phaseName: string
  signal: string
  operator?: string
  value?: number | string
  frequency?: number
  min_freq?: number
  max_freq?: number
  threshold?: number
  warningTime?: number
  enabled?: boolean
  mask?: number | string
}

export interface MisusePhase {
  phaseName: string
  alertType: 'visual' | 'audio' | 'visual+audio' | 'signal'
  signal: string
  operator?: string
  value?: number | string
  min_freq?: number
  max_freq?: number
  threshold?: number
  timeConstraint?: string
  timeConstraintUnit?: 's' | 'min'
  periodRepetition?: number
  speedCondition?: string
  verificationMethod?: 'signal' | 'manual' | 'video' | 'CAN'
  enabled?: boolean
  mask?: number | string
  speedMode?: 'manual' | 'signal'
  speedSignal?: string
}

export interface GaugeConfig {
  min: number
  max: number
  ticks?: number[]
  ticks_count?: number
}

const DEFAULT_SIGNAL_LISTS: Record<string, SignalConfig[]> = {
  "Long Distraction (NDT)": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Long Distraction (DT)": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Short Distraction (NDT)": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Short Distraction (DT)": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Microsleep": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Sleep": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Drowsiness": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Unresponsive driver (SLE)": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Unresponsive driver (DTR)": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "High Speed": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ],
  "Low Speed": [
    { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
  ]
}

const DEFAULT_PASS_CRITERIA: Record<string, PassConfig> = {
  "Long Distraction (NDT)": { signal: 'SoundPressure', operator1: '>', value1: 3.0, operator2: '<', value2: 4.0, mask: 6.0 },
  "Long Distraction (DT)": { signal: 'SoundPressure', operator1: '>', value1: 3.0, operator2: '<', value2: 4.0, mask: 6.0 },
  "Short Distraction (NDT)": { signal: 'SoundPressure', operator1: '>', value1: 0.0, operator2: '<', value2: 12.0, mask: 6.0 },
  "Short Distraction (DT)": { signal: 'SoundPressure', operator1: '>', value1: 0.0, operator2: '<', value2: 12.0, mask: 6.0 },
  "Microsleep": { signal: 'SoundPressure', operator1: '>', value1: 1.0, operator2: '<', value2: 2.0, mask: 6.0 },
  "Sleep": { signal: 'SoundPressure', operator1: '>', value1: 2.8, operator2: '<', value2: 3.2, mask: 6.0 },
  "Drowsiness": { signal: 'SoundPressure', operator1: '>', value1: 0.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Unresponsive driver (SLE)": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Unresponsive driver (DTR)": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "High Speed": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Low Speed": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 }
}

const DEFAULT_GAUGE_RULES: Record<string, GaugeConfig> = {
  "Long Distraction (NDT)": { min: 0, max: 10 },
  "Long Distraction (DT)": { min: 0, max: 10 },
  "Short Distraction (NDT)": { min: 0, max: 10 },
  "Short Distraction (DT)": { min: 0, max: 10 },
  "Microsleep": { min: 0, max: 10 },
  "Sleep": { min: 0, max: 10 },
  "Drowsiness": { min: 0, max: 10 },
  "Unresponsive driver (SLE)": { min: 0, max: 10 },
  "Unresponsive driver (DTR)": { min: 0, max: 10 },
  "High Speed": { min: 0, max: 10 },
  "Low Speed": { min: 0, max: 10 }
}

const DEFAULT_UNRESPONSIVE_CRITERIA: Record<string, UnresponsivePhase[]> = {
  "Unresponsive driver (DTR)": [
    { phaseName: "Distraction Warning", signal: "SoundPressure", min_freq: 800, max_freq: 1200, threshold: 0.5, enabled: true },
    { phaseName: "Distinct Warning", signal: "SoundPressure", min_freq: 1300, max_freq: 1700, threshold: 0.5, enabled: true },
    { phaseName: "Emergency Function", signal: "SoundPressure", min_freq: 1800, max_freq: 2200, threshold: 0.5, enabled: true }
  ],
  "Unresponsive driver (SLE)": [
    { phaseName: "Distinct Warning", signal: "SoundPressure", min_freq: 800, max_freq: 2000, threshold: 0.5, enabled: true },
    { phaseName: "Emergency Function", signal: "SoundPressure", min_freq: 1500, max_freq: 3000, threshold: 0.5, enabled: true }
  ]
}

const DEFAULT_MISUSE_CRITERIA: Record<string, MisusePhase[]> = {
  "OoP \u2014 Initial Phase": [
    { phaseName: "Detection", alertType: "visual", signal: "", enabled: true, verificationMethod: "video" },
    { phaseName: "Audio Warning", alertType: "audio", signal: "SoundPressure", min_freq: 800, max_freq: 2000, threshold: 0.5, enabled: true, speedCondition: "40", speedMode: "manual", verificationMethod: "signal" }
  ],
  "OoP — Change of Status": [
    { phaseName: "Detection", alertType: "signal", signal: "FaceOnFacia", operator: "==", value: 1, enabled: true, verificationMethod: "signal", mask: "previous" }
  ],
  "OoP — 15 min Warning": [
    { phaseName: "Detection", alertType: "signal", signal: "FaceOnFacia", operator: "==", value: 1, enabled: true, verificationMethod: "signal", mask: "previous" }
  ],
  "CSR — Initial Phase": [
    { phaseName: "Detection", alertType: "visual", signal: "", enabled: true, verificationMethod: "video" },
    { phaseName: "Audio Warning", alertType: "audio", signal: "SoundPressure", min_freq: 800, max_freq: 2000, threshold: 0.5, enabled: true, timeConstraint: "≥90", timeConstraintUnit: "s", verificationMethod: "signal" }
  ],
  "CSR — Change of Status": [
    { phaseName: "Detection", alertType: "signal", signal: "LapBeltOnly", operator: "==", value: 1, enabled: true, verificationMethod: "signal", mask: "previous", timeConstraint: "≥90", timeConstraintUnit: "s" }
  ]
}

function cleanUnresponsiveCriteria(criteria: any): Record<string, UnresponsivePhase[]> {
  const result: Record<string, UnresponsivePhase[]> = {}
  if (criteria && typeof criteria === 'object' && !Array.isArray(criteria)) {
    for (const [catName, uc] of Object.entries(criteria)) {
      if (Array.isArray(uc)) {
        let filtered = uc as UnresponsivePhase[]
        const isSle = catName.toLowerCase().includes('sle')
        const isDtr = catName.toLowerCase().includes('dtr')
        if (isSle) {
          filtered = filtered.filter(p => p.phaseName !== 'Sleep Warning')
        }
        
        // Normalize names to standard ones to prevent UI pill mismatch
        const stdNames = isDtr
          ? ["Distraction Warning", "Distinct Warning", "Emergency Function"]
          : (isSle ? ["Distinct Warning", "Emergency Function"] : [])
        
        filtered = filtered.map((p, idx) => ({
          ...p,
          phaseName: stdNames[idx] || p.phaseName
        }))
        
        result[catName] = filtered
      }
    }
  }
  return result;
}

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

  fuseSignalsCache: Record<string, SignalEntry[]>
  setFuseSignalsCache: (cache: Record<string, SignalEntry[]>) => void

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
  analysisActiveTab: string
  setAnalysisActiveTab: (tab: string) => void
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
  updateFileStatus: (filePath: string, status: Partial<{ has_tracking: boolean; has_marks: boolean; has_report: boolean }>) => void
  analysisExpandedAll: boolean | null
  setAnalysisExpandedAll: (v: boolean | null) => void
  analysisAvailableCameras: (number | string)[]
  setAnalysisAvailableCameras: (c: (number | string)[]) => void
  analysisSelectedCamera: number | string
  setAnalysisSelectedCamera: (c: number | string) => void
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
  analysisBatchRunning: boolean
  setAnalysisBatchRunning: (v: boolean) => void
  analysisChronosProgress: number
  setAnalysisChronosProgress: (v: number) => void
  analysisChronosStats: any
  setAnalysisChronosStats: (s: any) => void
  analysisChronosFrame: string | null
  setAnalysisChronosFrame: (frame: string | null) => void
  analysisGamificationFilter: string
  setAnalysisGamificationFilter: (v: string) => void

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

  // Analysis Metadata state
  analysisOem: string
  setAnalysisOem: (v: string) => void
  analysisVehicle: string
  setAnalysisVehicle: (v: string) => void
  analysisTrack: string
  setAnalysisTrack: (v: string) => void
  analysisEngineer: string
  setAnalysisEngineer: (v: string) => void
  analysisAnalyst: string
  setAnalysisAnalyst: (v: string) => void
  analysisEuroNcap: boolean
  setAnalysisEuroNcap: (v: boolean) => void

  // Audio state
  audioMinFreq: number
  setAudioMinFreq: (v: number | ((prev: number) => number)) => void
  audioMaxFreq: number
  setAudioMaxFreq: (v: number | ((prev: number) => number)) => void
  audioThreshold: number
  setAudioThreshold: (v: number | ((prev: number) => number)) => void

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
  brainEpochs: number
  setBrainEpochs: (e: number) => void
  brainLR: number
  setBrainLR: (lr: number) => void
  brainPatience: number
  setBrainPatience: (p: number) => void
  brainBatchSize: number
  setBrainBatchSize: (b: number) => void
  brainWeightDecay: number
  setBrainWeightDecay: (w: number) => void
  brainVideoFps: number
  setBrainVideoFps: (f: number) => void
  brainTraining: boolean
  setBrainTraining: (v: boolean) => void
  brainPhase: string
  setBrainPhase: (p: string) => void
  brainPhaseProgress: number
  setBrainPhaseProgress: (v: number) => void
  brainEpochData: any[]
  addBrainEpochData: (d: any) => void
  clearBrainEpochData: () => void
  brainDatasetStats: any
  setBrainDatasetStats: (s: any) => void
  brainAnalysisFile: string
  setBrainAnalysisFile: (f: string) => void
  brainAnalysisVideo: string
  setBrainAnalysisVideo: (v: string) => void
  brainAnalysisMarkers: any[]
  setBrainAnalysisMarkers: (m: any[]) => void

  // Config state
  protocol: 'Euro NCAP' | 'GSR ADDW'
  setProtocol: (p: 'Euro NCAP' | 'GSR ADDW') => void
  signalsConfig: Record<string, SignalConfig[]>
  setSignalsConfig: (c: Record<string, SignalConfig[]>) => void
  passCriteria: Record<string, PassConfig>
  setPassCriteria: (pc: Record<string, PassConfig>) => void
  unresponsiveCriteria: Record<string, UnresponsivePhase[]>
  setUnresponsiveCriteria: (uc: Record<string, UnresponsivePhase[]>) => void
  misuseCriteria: Record<string, MisusePhase[]>
  setMisuseCriteria: (mc: Record<string, MisusePhase[]>) => void
  gaugeRules: Record<string, GaugeConfig>
  setGaugeRules: (gr: Record<string, GaugeConfig>) => void
  loadedFiles: Record<string, string>
  setLoadedFiles: (lf: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
  importedConfigName: string | null
  setImportedConfigName: (n: string | null) => void
  gaugeRulesPath: string | null
  setGaugeRulesPath: (path: string | null) => void
  knownGaugeRulesPaths: string[]
  setKnownGaugeRulesPaths: (paths: string[]) => void

  // Prompt state
  isPromptingForPath: boolean
  setIsPromptingForPath: (v: boolean) => void
  pendingConfig: any | null
  setPendingConfig: (c: any | null) => void
  pendingConfigName: string | null
  setPendingConfigName: (n: string | null) => void

  // Config actions
  autoLoadChannelsAndMerge: (importedCategories?: Record<string, SignalConfig[]>, targetProtocol?: 'Euro NCAP' | 'GSR ADDW', targetResults?: any[], isMisuse?: boolean, onlyForCategory?: string) => Promise<void>
  importConfigJSON: (fileContent: string, fileName: string) => Promise<void>
  confirmPromptedPath: (path: string) => Promise<boolean>
  exportConfig: () => Promise<void>
  handleUnmountConfig: () => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: 'fuse',
  setActiveModule: (mod) => set({ activeModule: mod }),
  systemStats: null,
  setSystemStats: (stats) => set({ systemStats: stats }),
  sourcePath: '',
  setSourcePath: (path) => set({ sourcePath: path }),

  analysisActiveTab: 'audio',
  setAnalysisActiveTab: (tab) => set({ analysisActiveTab: tab }),

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

  fuseSignalsCache: {},
  setFuseSignalsCache: (cache) => set({ fuseSignalsCache: cache }),

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
  updateFileStatus: (filePath, status) =>
    set((s) => {
      // Recompute aggregate stats for a parent node after a child changed
      const recomputeStats = (node: any): any => {
        let totalMf4 = 0, totalTracking = 0, totalMarks = 0, totalAnalysis = 0
        const walk = (n: any) => {
          if (n.type === 'file') {
            totalMf4++
            if (n.has_tracking) totalTracking++
            if (n.has_marks) totalMarks++
            if (n.has_report) totalAnalysis++
          }
          if (n.children) n.children.forEach(walk)
        }
        node.children?.forEach(walk)
        return {
          ...node,
          tracking_stats: [totalTracking, totalMf4],
          marks_stats: [totalMarks, totalMf4],
          analysis_stats: [totalAnalysis, totalMf4],
        }
      }

      // Recursively patch the matching file node; return same ref if unchanged
      const patchNode = (node: any): any => {
        if (node.type === 'file') {
          if (node.path !== filePath) return node
          return { ...node, ...status }
        }
        if (!node.children) return node
        let changed = false
        const newChildren = node.children.map((c: any) => {
          const nc = patchNode(c)
          if (nc !== c) changed = true
          return nc
        })
        if (!changed) return node
        return recomputeStats({ ...node, children: newChildren })
      }

      const newResults = s.analysisResults.map(patchNode)
      // Bail out early if nothing changed — avoids unnecessary re-renders
      const anyChanged = newResults.some((r, i) => r !== s.analysisResults[i])
      if (!anyChanged) return s
      return { analysisResults: newResults }
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
  analysisBatchRunning: false,
  setAnalysisBatchRunning: (v) => set({ analysisBatchRunning: v }),
  analysisChronosProgress: 0,
  setAnalysisChronosProgress: (v: number) => set({ analysisChronosProgress: v }),
  analysisChronosStats: null as any,
  setAnalysisChronosStats: (s: any) => set({ analysisChronosStats: s }),
  analysisChronosFrame: null as string | null,
  setAnalysisChronosFrame: (frame) => set({ analysisChronosFrame: frame }),
  analysisGamificationFilter: 'none',
  setAnalysisGamificationFilter: (v) => set({ analysisGamificationFilter: v }),

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

  // Analysis Metadata state
  analysisOem: '',
  setAnalysisOem: (v) => set({ analysisOem: v }),
  analysisVehicle: '',
  setAnalysisVehicle: (v) => set({ analysisVehicle: v }),
  analysisTrack: '',
  setAnalysisTrack: (v) => set({ analysisTrack: v }),
  analysisEngineer: '',
  setAnalysisEngineer: (v) => set({ analysisEngineer: v }),
  analysisAnalyst: '',
  setAnalysisAnalyst: (v) => set({ analysisAnalyst: v }),
  analysisEuroNcap: false,
  setAnalysisEuroNcap: (v) => set({ analysisEuroNcap: v }),

  // Audio state
  audioMinFreq: 230,
  setAudioMinFreq: (v) => set((state) => ({ audioMinFreq: typeof v === 'function' ? v(state.audioMinFreq) : v })),
  audioMaxFreq: 2000,
  setAudioMaxFreq: (v) => set((state) => ({ audioMaxFreq: typeof v === 'function' ? v(state.audioMaxFreq) : v })),
  audioThreshold: 0.5,
  setAudioThreshold: (v) => set((state) => ({ audioThreshold: typeof v === 'function' ? v(state.audioThreshold) : v })),

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
  brainEpochs: 150,
  setBrainEpochs: (e) => set({ brainEpochs: e }),
  brainLR: 0.001,
  setBrainLR: (lr) => set({ brainLR: lr }),
  brainPatience: 20,
  setBrainPatience: (p) => set({ brainPatience: p }),
  brainBatchSize: 32,
  setBrainBatchSize: (b) => set({ brainBatchSize: b }),
  brainWeightDecay: 0.0001,
  setBrainWeightDecay: (w) => set({ brainWeightDecay: w }),
  brainVideoFps: 5,
  setBrainVideoFps: (f) => set({ brainVideoFps: f }),
  brainTraining: false,
  setBrainTraining: (v) => set({ brainTraining: v }),
  brainPhase: '',
  setBrainPhase: (p) => set({ brainPhase: p }),
  brainPhaseProgress: 0,
  setBrainPhaseProgress: (v) => set({ brainPhaseProgress: v }),
  brainEpochData: [],
  addBrainEpochData: (d) => set((s) => ({ brainEpochData: [...s.brainEpochData, d] })),
  clearBrainEpochData: () => set({ brainEpochData: [] }),
  brainDatasetStats: null,
  setBrainDatasetStats: (s) => set({ brainDatasetStats: s }),
  brainAnalysisFile: '',
  setBrainAnalysisFile: (f) => set({ brainAnalysisFile: f }),
  brainAnalysisVideo: '',
  setBrainAnalysisVideo: (v) => set({ brainAnalysisVideo: v }),
  brainAnalysisMarkers: [],
  setBrainAnalysisMarkers: (m) => set({ brainAnalysisMarkers: m }),

  // Config state init
  protocol: 'Euro NCAP',
  setProtocol: (p) => set({ protocol: p }),
  signalsConfig: DEFAULT_SIGNAL_LISTS,
  setSignalsConfig: (c) => set({ signalsConfig: c }),
  passCriteria: DEFAULT_PASS_CRITERIA,
  setPassCriteria: (pc) => set({ passCriteria: pc }),
  unresponsiveCriteria: DEFAULT_UNRESPONSIVE_CRITERIA,
  setUnresponsiveCriteria: (uc) => set({ unresponsiveCriteria: uc }),
  misuseCriteria: DEFAULT_MISUSE_CRITERIA,
  setMisuseCriteria: (mc) => set({ misuseCriteria: mc }),
  gaugeRules: DEFAULT_GAUGE_RULES,
  setGaugeRules: (gr) => set({ gaugeRules: gr }),
  loadedFiles: {},
  setLoadedFiles: (lf) => set((s) => ({ loadedFiles: typeof lf === 'function' ? lf(s.loadedFiles) : lf })),
  importedConfigName: null,
  setImportedConfigName: (n) => set({ importedConfigName: n }),
  gaugeRulesPath: null,
  setGaugeRulesPath: (path) => set({ gaugeRulesPath: path }),
  knownGaugeRulesPaths: JSON.parse(localStorage.getItem('knownGaugeRulesPaths') || '[]'),
  setKnownGaugeRulesPaths: (paths) => {
    localStorage.setItem('knownGaugeRulesPaths', JSON.stringify(paths))
    set({ knownGaugeRulesPaths: paths })
  },

  // Prompt state init
  isPromptingForPath: false,
  setIsPromptingForPath: (v) => set({ isPromptingForPath: v }),
  pendingConfig: null,
  setPendingConfig: (c) => set({ pendingConfig: c }),
  pendingConfigName: null,
  setPendingConfigName: (n) => set({ pendingConfigName: n }),

  // Config actions implementation
  autoLoadChannelsAndMerge: async (importedCategories, targetProtocol, targetResults, isMisuse, onlyForCategory) => {
    const state = useAppStore.getState()
    const activeProtocol = targetProtocol || state.protocol
    const targetCategoriesList = onlyForCategory
      ? [onlyForCategory]
      : (isMisuse
          ? [
              "OoP \u2014 Initial Phase",
              "OoP \u2014 Change of Status",
              "OoP \u2014 15 min Warning",
              "CSR \u2014 Initial Phase",
              "CSR \u2014 Change of Status"
            ]
          : (activeProtocol === 'Euro NCAP' 
              ? [
                  "Long Distraction (NDT)",
                  "Long Distraction (DT)",
                  "Short Distraction (NDT)",
                  "Short Distraction (DT)",
                  "Microsleep",
                  "Sleep",
                  "Drowsiness",
                  "Unresponsive driver (SLE)",
                  "Unresponsive driver (DTR)"
                ]
              : [
                  "High Speed",
                  "Low Speed"
                ]))

    const activeResults = targetResults || state.analysisResults

    if (!activeResults || activeResults.length === 0) {
      if (importedCategories) {
        set({ signalsConfig: importedCategories })
      }
      return
    }

    const firstParticipant = activeResults.find((r: any) => r.type === 'participant')
    if (!firstParticipant) {
      if (importedCategories) {
        set({ signalsConfig: importedCategories })
      }
      return
    }

    const getMf4Files = (node: any): string[] => {
      let files: string[] = []
      if (node.type === 'file' && node.path.toLowerCase().endsWith('.mf4') && !node.path.toLowerCase().includes('tracking')) {
        files.push(node.path)
      }
      if (node.children) {
        for (const child of node.children) {
          files = files.concat(getMf4Files(child))
        }
      }
      return files
    }

    const mdfFiles = getMf4Files(firstParticipant)
    if (mdfFiles.length === 0) {
      if (importedCategories) {
        set({ signalsConfig: importedCategories })
      }
      return
    }

    const determineCategoryFromFilename = (filename: string): string | null => {
      const cleanName = filename.split(/[/\\]/).pop() || ''
      const basename = cleanName.substring(0, cleanName.lastIndexOf('.')) || cleanName
      
      if (basename.toUpperCase().includes('ADDW')) {
        const lowerPath = filename.toLowerCase()
        if (lowerPath.includes('high speed')) {
          return 'High Speed'
        } else if (lowerPath.includes('low speed')) {
          return 'Low Speed'
        } else {
          return 'High Speed'
        }
      }
      
      const dMatch = basename.match(/^D(\d+)/i)
      if (dMatch) {
        const num = parseInt(dMatch[1], 10)
        if (num >= 1 && num <= 9) return 'Long Distraction (NDT)'
        if (num >= 10 && num <= 15) return 'Long Distraction (DT)'
        if ((num >= 16 && num <= 19) || num === 28 || (num >= 29 && num <= 42)) return 'Short Distraction (NDT)'
        if (num >= 20 && num <= 27) return 'Short Distraction (DT)'
      }
      
      const fMatch = basename.match(/^F(\d+)/i)
      if (fMatch) {
        const num = parseInt(fMatch[1], 10)
        if (num === 1) return 'Microsleep'
        if (num === 2) return 'Sleep'
        if (num === 3) return 'Drowsiness'
        if (num === 4) return 'Unresponsive driver (SLE)'
        if (num === 5) return 'Unresponsive driver (DTR)'
      }
      
      return null
    }

    let loadedCount = 0
    const newConfigs = importedCategories ? { ...importedCategories } : { ...state.signalsConfig }
    const newLoadedFiles = { ...state.loadedFiles }
    const toastId = toast.loading("Auto-loading MF4 data...")

    if (isMisuse) {
      const representativeFile = onlyForCategory
        ? (mdfFiles.find(f => getOmScenarioCategory(f) === onlyForCategory) || mdfFiles.find(f => getOmScenarioCategory(f) !== null) || mdfFiles[0])
        : (mdfFiles.find(f => getOmScenarioCategory(f) !== null) || mdfFiles[0])
      try {
        const response = await fetch('/api/analysis/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: representativeFile })
        })
        const data = await response.json()
        if (data.channels && Array.isArray(data.channels)) {
          const names = data.channels.map((ch: any) => ch.name).sort()
          const filteredNames = names.filter((name: string) => name.toLowerCase() !== 't' && name.toLowerCase() !== 'time')

          for (const category of targetCategoriesList) {
            const existingCategoryConfig = newConfigs[category] || []
            const isConfigValid = existingCategoryConfig && Array.isArray(existingCategoryConfig)

            const rebuiltList: SignalConfig[] = [
              isConfigValid
                ? existingCategoryConfig.find(sig => sig && sig.name === 'SoundPressure') || { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
                : { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
            ]

            for (const name of filteredNames) {
              if (name === 'SoundPressure') continue

              const existingSig = isConfigValid ? existingCategoryConfig.find(sig => sig && sig.name === name) : undefined
              if (existingSig) {
                rebuiltList.push(existingSig)
              } else {
                rebuiltList.push({
                  name,
                  checked: false,
                  operator: 'None',
                  threshold: 0.0,
                  alias: name
                })
              }
            }

            if (isConfigValid) {
              for (const sig of existingCategoryConfig) {
                if (sig && sig.name !== 'SoundPressure' && !filteredNames.includes(sig.name)) {
                  rebuiltList.push(sig)
                }
              }
            }

            const seen = new Set<string>()
            const uniqueRebuiltList: SignalConfig[] = []
            for (const sig of rebuiltList) {
              if (sig && sig.name && !seen.has(sig.name)) {
                seen.add(sig.name)
                uniqueRebuiltList.push(sig)
              }
            }

            newConfigs[category] = uniqueRebuiltList
            newLoadedFiles[category] = representativeFile
          }

          set({ signalsConfig: newConfigs, loadedFiles: newLoadedFiles })
          toast.dismiss(toastId)
          toast.success("Auto-loaded & merged MF4 data for all Misuse categories using representative file.")
        } else {
          toast.dismiss(toastId)
          toast.error("Failed to read channels from representative file.")
        }
      } catch (error) {
        toast.dismiss(toastId)
        toast.error("Failed to auto-load signals from files.")
        console.error(error)
      }
      return
    }

    try {
      for (const category of targetCategoriesList) {
        const matchingFile = isMisuse
          ? mdfFiles.find(f => getOmScenarioCategory(f) === category)
          : mdfFiles.find(f => determineCategoryFromFilename(f) === category)
        if (matchingFile) {
          const response = await fetch('/api/analysis/channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: matchingFile })
          })
          const data = await response.json()
          if (data.channels && Array.isArray(data.channels)) {
            const names = data.channels.map((ch: any) => ch.name).sort()
            const filteredNames = names.filter((name: string) => name.toLowerCase() !== 't' && name.toLowerCase() !== 'time')
            
            const existingCategoryConfig = newConfigs[category] || []
            const isConfigValid = existingCategoryConfig && Array.isArray(existingCategoryConfig)
            
            const rebuiltList: SignalConfig[] = [
              isConfigValid
                ? existingCategoryConfig.find(sig => sig && sig.name === 'SoundPressure') || { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
                : { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
            ]

            for (const name of filteredNames) {
              if (name === 'SoundPressure') continue
              
              const existingSig = isConfigValid ? existingCategoryConfig.find(sig => sig && sig.name === name) : undefined
              if (existingSig) {
                rebuiltList.push(existingSig)
              } else {
                rebuiltList.push({
                  name,
                  checked: false,
                  operator: 'None',
                  threshold: 0.0,
                  alias: name
                })
              }
            }

            if (isConfigValid) {
              for (const sig of existingCategoryConfig) {
                if (sig && sig.name !== 'SoundPressure' && !filteredNames.includes(sig.name)) {
                  rebuiltList.push(sig)
                }
              }
            }

            const seen = new Set<string>()
            const uniqueRebuiltList: SignalConfig[] = []
            for (const sig of rebuiltList) {
              if (sig && sig.name && !seen.has(sig.name)) {
                seen.add(sig.name)
                uniqueRebuiltList.push(sig)
              }
            }

            newConfigs[category] = uniqueRebuiltList
            newLoadedFiles[category] = matchingFile
            loadedCount++
          }
        }
      }

      set({ signalsConfig: newConfigs, loadedFiles: newLoadedFiles })
      toast.dismiss(toastId)
      if (loadedCount > 0) {
        toast.success(`Auto-loaded & merged MF4 data for ${loadedCount} categories.`)
      } else {
        toast.warning("No matching MF4 files found in the source directory.")
      }
    } catch (error) {
      toast.dismiss(toastId)
      toast.error("Failed to auto-load signals from files.")
      console.error(error)
    }
  },
  importConfigJSON: async (fileContent, fileName) => {
    try {
      if (!fileContent) {
        toast.error("The imported file is empty.")
        return
      }
      const parsed = JSON.parse(fileContent)
      if (!parsed || typeof parsed !== 'object') {
        toast.error("Invalid configuration file format.")
        return
      }

      if (parsed.categories && typeof parsed.categories === 'object' && !Array.isArray(parsed.categories)) {
        if ("Microsleep & Sleep" in parsed.categories && !("Microsleep" in parsed.categories) && !("Sleep" in parsed.categories)) {
          parsed.categories["Microsleep"] = parsed.categories["Microsleep & Sleep"]
          parsed.categories["Sleep"] = parsed.categories["Microsleep & Sleep"]
        }
      }
      if (parsed.pass_criteria && typeof parsed.pass_criteria === 'object' && !Array.isArray(parsed.pass_criteria)) {
        if ("Microsleep & Sleep" in parsed.pass_criteria && !("Microsleep" in parsed.pass_criteria) && !("Sleep" in parsed.pass_criteria)) {
          parsed.pass_criteria["Microsleep"] = parsed.pass_criteria["Microsleep & Sleep"]
          parsed.pass_criteria["Sleep"] = parsed.pass_criteria["Microsleep & Sleep"]
        }
      }
      if (parsed.gauge_rules && typeof parsed.gauge_rules === 'object' && !Array.isArray(parsed.gauge_rules)) {
        if ("Microsleep & Sleep" in parsed.gauge_rules && !("Microsleep" in parsed.gauge_rules) && !("Sleep" in parsed.gauge_rules)) {
          parsed.gauge_rules["Microsleep"] = parsed.gauge_rules["Microsleep & Sleep"]
          parsed.gauge_rules["Sleep"] = parsed.gauge_rules["Microsleep & Sleep"]
        }
      }

      // Parse metadata from report
      let metaObj: any = {}
      if (parsed.report && typeof parsed.report === 'object') {
        const r = parsed.report
        metaObj = {
          analysisOem: typeof r.oem === 'string' ? r.oem : '',
          analysisVehicle: typeof r.vehicle === 'string' ? r.vehicle : '',
          analysisTrack: typeof r.track === 'string' ? r.track : '',
          analysisEngineer: typeof r.engineer === 'string' ? r.engineer : '',
          analysisAnalyst: typeof r.analyst === 'string' ? r.analyst : '',
          analysisEuroNcap: typeof r.ncap === 'boolean' ? r.ncap : false
        }
      }

      // Parse audio from micro
      let audioObj: any = {}
      if (parsed.micro && typeof parsed.micro === 'object') {
        const m = parsed.micro
        audioObj = {
          audioMinFreq: typeof m.min_freq === 'number' ? m.min_freq : 230,
          audioMaxFreq: typeof m.max_freq === 'number' ? m.max_freq : 2000,
          audioThreshold: typeof m.threshold === 'number' ? m.threshold : 0.5
        }
      }

      let validatedGaugeRulesPath: string | null = null
      if (typeof parsed.gauge_rules_path === 'string') {
        validatedGaugeRulesPath = parsed.gauge_rules_path
      }

      if (validatedGaugeRulesPath) {
        try {
          const checkRes = await fetch('/api/reporting/gauge_rules/exists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: validatedGaugeRulesPath })
          })
          const checkData = await checkRes.json()
          if (!checkData.exists) {
            toast.warning(`Warning: Gauge rules file not found at: ${validatedGaugeRulesPath}. Using default rules instead.`, { duration: 6000 })
            validatedGaugeRulesPath = null
          } else {
            const readRes = await fetch('/api/reporting/gauge_rules/read_file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ file_path: validatedGaugeRulesPath })
            })
            const readData = await readRes.json()
            if (readData.rules) {
              parsed.gauge_rules = readData.rules
              const currentKnown = useAppStore.getState().knownGaugeRulesPaths
              if (!currentKnown.includes(validatedGaugeRulesPath)) {
                useAppStore.getState().setKnownGaugeRulesPaths([...currentKnown, validatedGaugeRulesPath])
              }
            } else if (readData.error) {
              toast.error(`Error reading gauge rules file: ${readData.error}`)
            }
          }
        } catch (err) {
          console.error("Error loading gauge rules path:", err)
        }
      }

      let validatedProtocol: 'Euro NCAP' | 'GSR ADDW' = 'Euro NCAP'
      if (parsed.protocol === 'GSR ADDW' || parsed.protocol === 'Euro NCAP') {
        validatedProtocol = parsed.protocol
      }

      const validatedPassCriteria: Record<string, PassConfig> = {}
      if (parsed.pass_criteria && typeof parsed.pass_criteria === 'object' && !Array.isArray(parsed.pass_criteria)) {
        for (const [catName, pc] of Object.entries(parsed.pass_criteria)) {
          if (pc && typeof pc === 'object') {
            const op1 = typeof (pc as any).operator1 === 'string' ? (pc as any).operator1 : '<'
            const operator1 = ['None', '>', '<', '>=', '<=', '==', '!='].includes(op1) ? op1 : 'None'
            const op2 = typeof (pc as any).operator2 === 'string' ? (pc as any).operator2 : 'None'
            const operator2 = ['None', '>', '<', '>=', '<=', '==', '!='].includes(op2) ? op2 : 'None'
            
            validatedPassCriteria[catName] = {
              signal: typeof (pc as any).signal === 'string' ? (pc as any).signal : 'SoundPressure',
              value1: typeof (pc as any).value1 === 'number' ? (pc as any).value1 : 3.0,
              operator1: operator1 as any,
              value2: typeof (pc as any).value2 === 'number' ? (pc as any).value2 : 0.0,
              operator2: operator2 as any,
              mask: typeof (pc as any).mask === 'number' ? (pc as any).mask : 6.0
            }
          }
        }
      }
      const mergedPassCriteria = { ...DEFAULT_PASS_CRITERIA, ...validatedPassCriteria }

      const validatedUnresponsiveCriteria = cleanUnresponsiveCriteria(parsed.unresponsive_criteria)
      const mergedUnresponsiveCriteria = { ...DEFAULT_UNRESPONSIVE_CRITERIA, ...validatedUnresponsiveCriteria }

      const validatedGaugeRules: Record<string, GaugeConfig> = {}
      if (parsed.gauge_rules && typeof parsed.gauge_rules === 'object' && !Array.isArray(parsed.gauge_rules)) {
        for (const [catName, gr] of Object.entries(parsed.gauge_rules)) {
          if (gr && typeof gr === 'object') {
            const ticksCountVal = typeof (gr as any).ticks_count === 'number' ? (gr as any).ticks_count : undefined;
            const ticksVal = Array.isArray((gr as any).ticks) ? (gr as any).ticks.map(Number) : undefined;
            validatedGaugeRules[catName] = {
              min: typeof (gr as any).min === 'number' ? (gr as any).min : 0,
              max: typeof (gr as any).max === 'number' ? (gr as any).max : 10,
              ticks: ticksVal,
              ticks_count: ticksCountVal
            }
          }
        }
      }
      const mergedGaugeRules = { ...DEFAULT_GAUGE_RULES, ...validatedGaugeRules }

      const state = useAppStore.getState()
      let currentPath = state.analysisSourcePath
      let resultsData = state.analysisResults

      if (!currentPath) {
        const configPath = parsed.analysis_source_path || ''
        if (configPath) {
          const toastId = toast.loading(`Scanning path from config: ${configPath}`)
          try {
            const res = await fetch('/api/analysis/scan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source_dir: configPath }),
            })
            const data = await res.json()
            if (data.results && data.results.length > 0) {
              set({
                analysisSourcePath: configPath,
                analysisResults: data.results,
                analysisAvailableCameras: data.available_cameras || [],
                analysisCheckedFiles: [],
                ...metaObj,
                ...audioObj
              })
              
              const allFiles: string[] = []
              const collect = (nodes: any[]) => {
                for (const n of nodes) {
                  if (n.type === 'file') allFiles.push(n.path)
                  if (n.children) collect(n.children)
                }
              }
              collect(data.results)
              set({ analysisCheckedFiles: allFiles })
              
              resultsData = data.results
              currentPath = configPath
              toast.success("Path found and loaded successfully from config.")
            } else {
              set({
                protocol: validatedProtocol,
                passCriteria: mergedPassCriteria,
                unresponsiveCriteria: mergedUnresponsiveCriteria,
                gaugeRules: mergedGaugeRules,
                pendingConfig: parsed,
                pendingConfigName: fileName,
                isPromptingForPath: true,
                ...metaObj,
                ...audioObj
              })
              toast.warning(`Folder in config not found: "${configPath}". Please specify project folder.`)
              return
            }
          } catch (err) {
            console.error("Error scanning config path:", err)
            set({
              protocol: validatedProtocol,
              passCriteria: mergedPassCriteria,
              unresponsiveCriteria: mergedUnresponsiveCriteria,
              gaugeRules: mergedGaugeRules,
              pendingConfig: parsed,
              pendingConfigName: fileName,
              isPromptingForPath: true,
              ...metaObj,
              ...audioObj
            })
            toast.warning("Failed to load path from config. Please specify project folder.")
            return
          } finally {
            toast.dismiss(toastId)
          }
        } else {
          set({
            protocol: validatedProtocol,
            passCriteria: mergedPassCriteria,
            unresponsiveCriteria: mergedUnresponsiveCriteria,
            gaugeRules: mergedGaugeRules,
            pendingConfig: parsed,
            pendingConfigName: fileName,
            isPromptingForPath: true,
            ...metaObj,
            ...audioObj
          })
          toast.info("Imported config has no project path. Please specify project folder.")
          return
        }
      }

      set({
        protocol: validatedProtocol,
        passCriteria: mergedPassCriteria,
        unresponsiveCriteria: mergedUnresponsiveCriteria,
        gaugeRules: mergedGaugeRules,
        gaugeRulesPath: validatedGaugeRulesPath,
        importedConfigName: fileName,
        ...metaObj,
        ...audioObj
      })

      const validatedCategories: Record<string, SignalConfig[]> = {}
      if (parsed.categories && typeof parsed.categories === 'object' && !Array.isArray(parsed.categories)) {
        for (const [catName, signalList] of Object.entries(parsed.categories)) {
          if (Array.isArray(signalList)) {
            const seen = new Set<string>()
            const list: SignalConfig[] = []
            for (const sig of signalList) {
              if (!sig || typeof sig !== 'object') continue
              const rawName = sig.name ?? sig.signal
              if (typeof rawName !== 'string' || rawName.trim() === '') continue
              const name = rawName.trim()
              if (seen.has(name)) continue
              seen.add(name)
              const rawThreshold = sig.threshold ?? sig.value
              let threshold: number | string = 0.0
              if (typeof rawThreshold === 'number') {
                threshold = rawThreshold
              } else if (typeof rawThreshold === 'string') {
                const stripped = rawThreshold.replace(/^b'(.*)'$/, '$1').replace(/^b"(.*)"$/, '$1')
                const parsedFloat = parseFloat(stripped)
                if (!isNaN(parsedFloat) && stripped.trim() !== '') {
                  threshold = parsedFloat
                } else {
                  threshold = stripped
                }
              } else if (rawThreshold !== undefined && rawThreshold !== null) {
                threshold = String(rawThreshold)
              }
              const alias = typeof sig.alias === 'string' ? sig.alias : name
              const rawOp = sig.operator ?? 'None'
              const operator = (typeof rawOp === 'string' && ['None', '>', '<', '>=', '<=', '==', '!='].includes(rawOp)) ? rawOp : 'None'
              list.push({ name, checked: typeof sig.checked === 'boolean' ? sig.checked : false, operator, threshold, alias })
            }
            validatedCategories[catName] = list
          }
        }
      }
      const mergedCategories = { ...DEFAULT_SIGNAL_LISTS, ...validatedCategories }

      const hasMisuseCategories = Object.keys(validatedCategories).some(cat => 
        cat.includes("OoP") || cat.includes("CSR")
      )
      await state.autoLoadChannelsAndMerge(mergedCategories, validatedProtocol, resultsData, hasMisuseCategories)
      toast.success("Configuration imported successfully")
    } catch (err) {
      console.error("Import error:", err)
      toast.error("Failed to parse JSON file")
    }
  },
  confirmPromptedPath: async (path) => {
    if (!path) return false
    const state = useAppStore.getState()
    const toastId = toast.loading(`Scanning path: ${path}`)
    try {
      const res = await fetch('/api/analysis/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: path }),
      })
      const data = await res.json()
      if (data.results && data.results.length > 0) {
        set({
          analysisSourcePath: path,
          analysisResults: data.results,
          analysisAvailableCameras: data.available_cameras || [],
          analysisCheckedFiles: []
        })
        
        const allFiles: string[] = []
        const collect = (nodes: any[]) => {
          for (const n of nodes) {
            if (n.type === 'file') allFiles.push(n.path)
            if (n.children) collect(n.children)
          }
        }
        collect(data.results)
        set({ analysisCheckedFiles: allFiles })

        if (state.pendingConfig) {
          const parsed = state.pendingConfig
          let validatedGaugeRulesPath: string | null = null
          if (typeof parsed.gauge_rules_path === 'string') {
            validatedGaugeRulesPath = parsed.gauge_rules_path
          }
          
          let metaObj: any = {}
          if (parsed.report && typeof parsed.report === 'object') {
            const r = parsed.report
            metaObj = {
              analysisOem: typeof r.oem === 'string' ? r.oem : '',
              analysisVehicle: typeof r.vehicle === 'string' ? r.vehicle : '',
              analysisTrack: typeof r.track === 'string' ? r.track : '',
              analysisEngineer: typeof r.engineer === 'string' ? r.engineer : '',
              analysisAnalyst: typeof r.analyst === 'string' ? r.analyst : '',
              analysisEuroNcap: typeof r.ncap === 'boolean' ? r.ncap : false
            }
          }

          let audioObj: any = {}
          if (parsed.micro && typeof parsed.micro === 'object') {
            const m = parsed.micro
            audioObj = {
              audioMinFreq: typeof m.min_freq === 'number' ? m.min_freq : 230,
              audioMaxFreq: typeof m.max_freq === 'number' ? m.max_freq : 2000,
              audioThreshold: typeof m.threshold === 'number' ? m.threshold : 0.5
            }
          }

          set({
            protocol: parsed.protocol || 'Euro NCAP',
            passCriteria: { ...DEFAULT_PASS_CRITERIA, ...(parsed.pass_criteria || {}) },
            unresponsiveCriteria: { ...DEFAULT_UNRESPONSIVE_CRITERIA, ...cleanUnresponsiveCriteria(parsed.unresponsive_criteria) },
            gaugeRules: { ...DEFAULT_GAUGE_RULES, ...(parsed.gauge_rules || {}) },
            gaugeRulesPath: validatedGaugeRulesPath,
            importedConfigName: state.pendingConfigName || 'Imported Config',
            ...metaObj,
            ...audioObj
          })
          
          const validatedCategories: Record<string, SignalConfig[]> = {}
          if (parsed.categories && typeof parsed.categories === 'object' && !Array.isArray(parsed.categories)) {
            for (const [catName, signalList] of Object.entries(parsed.categories)) {
              if (Array.isArray(signalList)) {
                const seen = new Set<string>()
                const list: SignalConfig[] = []
                for (const sig of signalList) {
                  if (!sig || typeof sig !== 'object') continue
                  const rawName = sig.name ?? sig.signal
                  if (typeof rawName !== 'string' || rawName.trim() === '') continue
                  const name = rawName.trim()
                  if (seen.has(name)) continue
                  seen.add(name)
                  const rawThreshold = sig.threshold ?? sig.value
                  let threshold: number | string = 0.0
                  if (typeof rawThreshold === 'number') {
                    threshold = rawThreshold
                  } else if (typeof rawThreshold === 'string') {
                    const stripped = rawThreshold.replace(/^b'(.*)'$/, '$1').replace(/^b"(.*)"$/, '$1')
                    const parsedFloat = parseFloat(stripped)
                    if (!isNaN(parsedFloat) && stripped.trim() !== '') {
                      threshold = parsedFloat
                    } else {
                      threshold = stripped
                    }
                  } else if (rawThreshold !== undefined && rawThreshold !== null) {
                    threshold = String(rawThreshold)
                  }
                  const alias = typeof sig.alias === 'string' ? sig.alias : name
                  const rawOp = sig.operator ?? 'None'
                  const operator = (typeof rawOp === 'string' && ['None', '>', '<', '>=', '<=', '==', '!='].includes(rawOp)) ? rawOp : 'None'
                  list.push({ name, checked: typeof sig.checked === 'boolean' ? sig.checked : false, operator, threshold, alias })
                }
                validatedCategories[catName] = list
              }
            }
          }
          const mergedCategories = { ...DEFAULT_SIGNAL_LISTS, ...validatedCategories }
          
          const hasMisuseCategories = Object.keys(validatedCategories).some(cat => 
            cat.includes("OoP") || cat.includes("CSR")
          )
          await state.autoLoadChannelsAndMerge(mergedCategories, parsed.protocol || 'Euro NCAP', data.results, hasMisuseCategories)
        }

        set({ isPromptingForPath: false, pendingConfig: null, pendingConfigName: null })
        toast.success("Path loaded successfully and configuration applied.")
        return true
      } else {
        toast.error(`The folder could not be loaded. Please verify the folder exists.`)
        return false
      }
    } catch (err) {
      console.error("Error scanning path:", err)
      toast.error("Failed to scan project path.")
      return false
    } finally {
      toast.dismiss(toastId)
    }
  },
  exportConfig: async () => {
    const state = useAppStore.getState()
    const configObj = {
      version: 1,
      protocol: state.protocol,
      analysis_source_path: state.analysisSourcePath,
      categories: state.signalsConfig,
      pass_criteria: state.passCriteria,
      unresponsive_criteria: state.unresponsiveCriteria,
      gauge_rules: state.gaugeRules,
      gauge_rules_path: state.gaugeRulesPath,
      report: {
        oem: state.analysisOem,
        vehicle: state.analysisVehicle,
        track: state.analysisTrack,
        engineer: state.analysisEngineer,
        analyst: state.analysisAnalyst,
        ncap: state.analysisEuroNcap
      },
      micro: {
        min_freq: state.audioMinFreq,
        max_freq: state.audioMaxFreq,
        threshold: state.audioThreshold
      }
    }
    
    const suggestedName = `gaze_logic_config_${state.protocol.replace(/\s+/g, '_').toLowerCase()}.json`
    
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{
            description: 'JSON Files',
            accept: {
              'application/json': ['.json'],
            },
          }],
        })
        const writable = await handle.createWritable()
        await writable.write(JSON.stringify(configObj, null, 2))
        await writable.close()
        toast.success("Configuration saved successfully")
        return
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return
        }
        console.warn("showSaveFilePicker error, falling back to download anchor", err)
      }
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify(configObj, null, 2)
    )
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", suggestedName)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success("Configuration exported successfully")
  },
  handleUnmountConfig: () => {
    set({
      signalsConfig: DEFAULT_SIGNAL_LISTS,
      passCriteria: DEFAULT_PASS_CRITERIA,
      unresponsiveCriteria: DEFAULT_UNRESPONSIVE_CRITERIA,
      gaugeRules: DEFAULT_GAUGE_RULES,
      gaugeRulesPath: null,
      protocol: 'Euro NCAP',
      loadedFiles: {},
      importedConfigName: null,
      analysisOem: '',
      analysisVehicle: '',
      analysisTrack: '',
      analysisEngineer: '',
      analysisAnalyst: '',
      analysisEuroNcap: false,
      audioMinFreq: 230,
      audioMaxFreq: 2000,
      audioThreshold: 0.5
    })
    toast.success("Configuration unmounted. Defaults restored.")
  }
}))