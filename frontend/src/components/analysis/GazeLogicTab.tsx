import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu"
import { SearchableSelect } from "@/components/analysis/SearchableSelect"
import { 
  Save, 
  Download, 
  PlayCircle, 
  AlertCircle,
  Clock,
  Sliders,
  HelpCircle,
  Eye,
  Activity,
  Menu,
  Filter,
  RefreshCw,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore } from '@/store/useAppStore'
import { reportingApi } from '@/api/reportingApi'
import { toast } from 'sonner'

interface SignalConfig {
  name: string
  checked: boolean
  operator: string
  threshold: number
  alias: string
}

interface PassConfig {
  signal: string
  value1: number
  operator1: string
  value2: number
  operator2: string
  mask: number
}

interface GaugeConfig {
  min: number
  max: number
  green_min: number
  green_max: number
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
  "Unresponsive driver": [
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
  "Long Distraction (NDT)": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Long Distraction (DT)": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Short Distraction (NDT)": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Short Distraction (DT)": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Microsleep": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Sleep": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Drowsiness": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Unresponsive driver": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "High Speed": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 },
  "Low Speed": { signal: 'SoundPressure', operator1: '<', value1: 3.0, operator2: 'None', value2: 0.0, mask: 6.0 }
}

const DEFAULT_GAUGE_RULES: Record<string, GaugeConfig> = {
  "Long Distraction (NDT)": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Long Distraction (DT)": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Short Distraction (NDT)": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Short Distraction (DT)": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Microsleep": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Sleep": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Drowsiness": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Unresponsive driver": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "High Speed": { min: 0, max: 10, green_min: 0, green_max: 3 },
  "Low Speed": { min: 0, max: 10, green_min: 0, green_max: 3 }
}

export function GazeLogicTab() {
  const { 
    analysisSelectedFile, 
    analysisCheckedFiles, 
    analysisResults,
    analysisOem,
    analysisVehicle,
    analysisTrack,
    analysisEngineer,
    analysisAnalyst
  } = useAppStore()

  // Protocol state
  const [protocol, setProtocol] = useState<'Euro NCAP' | 'GSR ADDW'>('Euro NCAP')

  // Categories list based on active protocol
  const categoriesList = protocol === 'Euro NCAP' 
    ? [
        "Long Distraction (NDT)",
        "Long Distraction (DT)",
        "Short Distraction (NDT)",
        "Short Distraction (DT)",
        "Microsleep",
        "Sleep",
        "Drowsiness",
        "Unresponsive driver"
      ]
    : [
        "High Speed",
        "Low Speed"
      ]

  const [activeCategory, setActiveCategory] = useState<string>(categoriesList[0])

  // Sync active category on protocol changes
  useEffect(() => {
    setActiveCategory(protocol === 'Euro NCAP' ? "Long Distraction (NDT)" : "High Speed")
  }, [protocol])

  // Primary states
  const [signalsConfig, setSignalsConfig] = useState<Record<string, SignalConfig[]>>(DEFAULT_SIGNAL_LISTS)
  const [passCriteria, setPassCriteria] = useState<Record<string, PassConfig>>(DEFAULT_PASS_CRITERIA)
  const [gaugeRules, setGaugeRules] = useState<Record<string, GaugeConfig>>(DEFAULT_GAUGE_RULES)

  // Filter signals state
  const [filterQuery, setFilterQuery] = useState('')

  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // Batch generation progress states
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchLogs, setBatchLogs] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // Modals / Dropdowns
  const [gaugeRulesModalOpen, setGaugeRulesModalOpen] = useState(false)

  // Loaded MF4 files per scenario state
  const [loadedFiles, setLoadedFiles] = useState<Record<string, string>>({})
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false)
  const [allParticipantMf4s, setAllParticipantMf4s] = useState<string[]>([])
  const [fileSearchQuery, setFileSearchQuery] = useState('')
  // Unique signal values cache keyed by "filePath::signalName"
  const [signalValuesCache, setSignalValuesCache] = useState<Record<string, number[]>>({})
  const fetchingValuesRef = useRef<Set<string>>(new Set())

  // Sync participant files whenever analysisResults changes
  useEffect(() => {
    if (!analysisResults || analysisResults.length === 0) {
      setAllParticipantMf4s([])
      return
    }
    const firstParticipant = analysisResults.find((r: any) => r.type === 'participant')
    if (!firstParticipant) {
      setAllParticipantMf4s([])
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
    setAllParticipantMf4s(getMf4Files(firstParticipant))
  }, [analysisResults])

  // Load backend gauge rules on mount
  useEffect(() => {
    reportingApi.getGaugeRules()
      .then((res) => {
        if (res.data && Object.keys(res.data).length > 0) {
          const rules = { ...DEFAULT_GAUGE_RULES }
          Object.keys(res.data).forEach((key) => {
            if (res.data[key]) {
              rules[key] = {
                min: res.data[key].min ?? 0,
                max: res.data[key].max ?? 10,
                green_min: res.data[key].green_min ?? 0,
                green_max: res.data[key].green_max ?? 3
              }
            }
          })
          setGaugeRules(rules)
        }
      })
      .catch((err) => console.error("Error loading gauge rules:", err))
  }, [])

  // JSON Config Import & Export
  const handleExportConfig = async () => {
    const configObj = {
      version: 1,
      protocol,
      categories: signalsConfig,
      pass_criteria: passCriteria,
      gauge_rules: gaugeRules
    }
    
    const suggestedName = `gaze_logic_config_${protocol.replace(/\s+/g, '_').toLowerCase()}.json`
    
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

    // Fallback download anchor
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
  }

  // Load and merge channels from target MF4 files for each scenario
  const autoLoadChannelsAndMerge = async (
    importedCategories?: Record<string, SignalConfig[]>,
    targetProtocol?: 'Euro NCAP' | 'GSR ADDW'
  ) => {
    const activeProtocol = targetProtocol || protocol
    const targetCategoriesList = activeProtocol === 'Euro NCAP' 
      ? [
          "Long Distraction (NDT)",
          "Long Distraction (DT)",
          "Short Distraction (NDT)",
          "Short Distraction (DT)",
          "Microsleep",
          "Sleep",
          "Drowsiness",
          "Unresponsive driver"
        ]
      : [
          "High Speed",
          "Low Speed"
        ]

    // 1. Check if we have participants
    if (!analysisResults || analysisResults.length === 0) {
      if (importedCategories) {
        setSignalsConfig(importedCategories)
      }
      return
    }

    // Find first participant
    const firstParticipant = analysisResults.find((r: any) => r.type === 'participant')
    if (!firstParticipant) {
      if (importedCategories) {
        setSignalsConfig(importedCategories)
      }
      return
    }

    // 2. Gather all non-tracking MF4 files recursively
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
        setSignalsConfig(importedCategories)
      }
      return
    }

    // 3. Match MF4 files to categories and load signals
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
        if (num === 4 || num === 5) return 'Unresponsive driver'
      }
      
      return null
    }

    let loadedCount = 0
    
    // We will update the configs in a loop
    const newConfigs = importedCategories ? { ...importedCategories } : { ...signalsConfig }
    const newLoadedFiles = { ...loadedFiles }
    const toastId = toast.loading("Auto-loading MF4 data...")

    try {
      for (const category of targetCategoriesList) {
        const matchingFile = mdfFiles.find(f => determineCategoryFromFilename(f) === category)
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
            
            // Get already defined signals for this category
            const existingCategoryConfig = newConfigs[category] || []
            const isConfigValid = existingCategoryConfig && Array.isArray(existingCategoryConfig)
            
            // Re-build signals list: for each channel, preserve imported config if present, or add default
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

            newConfigs[category] = rebuiltList
            newLoadedFiles[category] = matchingFile
            loadedCount++
          }
        }
      }

      setSignalsConfig(newConfigs)
      setLoadedFiles(newLoadedFiles)
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
  }

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result as string
        if (!fileContent) {
          toast.error("The imported file is empty.")
          return
        }
        const parsed = JSON.parse(fileContent)
        if (!parsed || typeof parsed !== 'object') {
          toast.error("Invalid configuration file format.")
          return
        }

        // Support backward compatibility / Python format splits
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

        // 1. Validate and sanitize protocol
        let validatedProtocol: 'Euro NCAP' | 'GSR ADDW' = 'Euro NCAP'
        if (parsed.protocol === 'GSR ADDW' || parsed.protocol === 'Euro NCAP') {
          validatedProtocol = parsed.protocol
        }

        // 2. Validate and sanitize categories
        const validatedCategories: Record<string, SignalConfig[]> = {}
        if (parsed.categories && typeof parsed.categories === 'object' && !Array.isArray(parsed.categories)) {
          for (const [catName, signalList] of Object.entries(parsed.categories)) {
            if (Array.isArray(signalList)) {
              validatedCategories[catName] = signalList
                .filter((sig: any) => {
                  if (!sig || typeof sig !== 'object') return false
                  const name = sig.name ?? sig.signal
                  return typeof name === 'string' && name.trim() !== ''
                })
                .map((sig: any) => {
                  const name = (sig.name ?? sig.signal ?? '').trim()
                  const rawThreshold = sig.threshold ?? sig.value
                  let threshold = 0.0
                  if (typeof rawThreshold === 'number') {
                    threshold = rawThreshold
                  } else if (typeof rawThreshold === 'string') {
                    const parsedFloat = parseFloat(rawThreshold)
                    if (!isNaN(parsedFloat)) {
                      threshold = parsedFloat
                    }
                  }
                  const alias = typeof sig.alias === 'string' ? sig.alias : name
                  return {
                    name,
                    checked: typeof sig.checked === 'boolean' ? sig.checked : false,
                    operator: typeof sig.operator === 'string' ? sig.operator : 'None',
                    threshold,
                    alias
                  }
                })
            }
          }
        }

        // Merge with defaults to ensure completeness
        const mergedCategories = { ...DEFAULT_SIGNAL_LISTS, ...validatedCategories }

        // 3. Validate and sanitize pass_criteria
        const validatedPassCriteria: Record<string, PassConfig> = {}
        if (parsed.pass_criteria && typeof parsed.pass_criteria === 'object' && !Array.isArray(parsed.pass_criteria)) {
          for (const [catName, pc] of Object.entries(parsed.pass_criteria)) {
            if (pc && typeof pc === 'object') {
              validatedPassCriteria[catName] = {
                signal: typeof (pc as any).signal === 'string' ? (pc as any).signal : 'SoundPressure',
                value1: typeof (pc as any).value1 === 'number' ? (pc as any).value1 : 3.0,
                operator1: typeof (pc as any).operator1 === 'string' ? (pc as any).operator1 : '<',
                value2: typeof (pc as any).value2 === 'number' ? (pc as any).value2 : 0.0,
                operator2: typeof (pc as any).operator2 === 'string' ? (pc as any).operator2 : 'None',
                mask: typeof (pc as any).mask === 'number' ? (pc as any).mask : 6.0
              }
            }
          }
        }
        const mergedPassCriteria = { ...DEFAULT_PASS_CRITERIA, ...validatedPassCriteria }

        // 4. Validate and sanitize gauge_rules
        const validatedGaugeRules: Record<string, GaugeConfig> = {}
        if (parsed.gauge_rules && typeof parsed.gauge_rules === 'object' && !Array.isArray(parsed.gauge_rules)) {
          for (const [catName, gr] of Object.entries(parsed.gauge_rules)) {
            if (gr && typeof gr === 'object') {
              validatedGaugeRules[catName] = {
                min: typeof (gr as any).min === 'number' ? (gr as any).min : 0,
                max: typeof (gr as any).max === 'number' ? (gr as any).max : 10,
                green_min: typeof (gr as any).green_min === 'number' ? (gr as any).green_min : 0,
                green_max: typeof (gr as any).green_max === 'number' ? (gr as any).green_max : 3
              }
            }
          }
        }
        const mergedGaugeRules = { ...DEFAULT_GAUGE_RULES, ...validatedGaugeRules }

        // Update states
        setProtocol(validatedProtocol)
        setPassCriteria(mergedPassCriteria)
        setGaugeRules(mergedGaugeRules)

        // Autoload channels & merge with the imported categories configuration
        await autoLoadChannelsAndMerge(mergedCategories, validatedProtocol)

        toast.success("Configuration imported successfully")
      } catch (err) {
        console.error("Import error:", err)
        toast.error("Failed to parse JSON file")
      }
    }
    reader.readAsText(file)
  }

  const handleAutoLoadData = async () => {
    await autoLoadChannelsAndMerge()
  }

  const fetchSignalValues = async (filePath: string, signalName: string) => {
    const cacheKey = `${filePath}::${signalName}`
    if (fetchingValuesRef.current.has(cacheKey)) return
    fetchingValuesRef.current.add(cacheKey)
    try {
      const res = await fetch('/api/analysis/signal_unique_values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, channel_name: signalName })
      })
      const data = await res.json()
      if (data.values && Array.isArray(data.values) && data.values.length > 0) {
        setSignalValuesCache(prev => ({ ...prev, [cacheKey]: data.values }))
      }
    } catch {
      fetchingValuesRef.current.delete(cacheKey)
    }
  }

  const handleSelectFile = async (filePath: string) => {
    setFileSelectorOpen(false)
    const toastId = toast.loading(`Loading channels from ${filePath.split(/[/\\]/).pop()}...`)
    try {
      const response = await fetch('/api/analysis/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath })
      })
      const data = await response.json()
      if (data.channels && Array.isArray(data.channels)) {
        const names = data.channels.map((ch: any) => ch.name).sort()
        const filteredNames = names.filter((name: string) => name.toLowerCase() !== 't' && name.toLowerCase() !== 'time')
        
        const existingCategoryConfig = signalsConfig[activeCategory] || []
        const rebuiltList: SignalConfig[] = [
          existingCategoryConfig.find(sig => sig && sig.name === 'SoundPressure') || { name: 'SoundPressure', checked: true, operator: 'None', threshold: 0.0, alias: 'SoundPressure' }
        ]

        for (const name of filteredNames) {
          if (name === 'SoundPressure') continue
          const existingSig = existingCategoryConfig.find(sig => sig && sig.name === name)
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

        for (const sig of existingCategoryConfig) {
          if (sig && sig.name !== 'SoundPressure' && !filteredNames.includes(sig.name)) {
            rebuiltList.push(sig)
          }
        }

        setSignalsConfig(prev => ({ ...prev, [activeCategory]: rebuiltList }))
        setLoadedFiles(prev => ({ ...prev, [activeCategory]: filePath }))
        toast.dismiss(toastId)
        toast.success(`Loaded channels for ${activeCategory}.`)
        // Background: fetch unique threshold values for all checked, non-SoundPressure signals
        rebuiltList
          .filter(s => s.checked && s.name !== 'SoundPressure')
          .forEach(s => fetchSignalValues(filePath, s.name))
      } else {
        toast.dismiss(toastId)
        toast.error("Failed to read channels from selected file.")
      }
    } catch (error) {
      toast.dismiss(toastId)
      toast.error("Failed to load file channels.")
      console.error(error)
    }
  }

  // Update logic configuration for category signals (using unique name lookup for safe filtering update)
  const updateSignalField = (category: string, name: string, field: keyof SignalConfig, value: any) => {
    setSignalsConfig(prev => {
      const list = [...(prev[category] || [])]
      const index = list.findIndex(s => s.name === name)
      if (index !== -1) {
        list[index] = { ...list[index], [field]: value }
      }
      return { ...prev, [category]: list }
    })
  }

  // PASS Criteria Configuration Updates
  const updatePassCriteriaField = (category: string, field: keyof PassConfig, value: any) => {
    setPassCriteria(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || { signal: 'SoundPressure', value1: 3.0, operator1: '<', value2: 0, operator2: 'None', mask: 6.0 }),
        [field]: value
      }
    }))
  }

  // Gauge Rules Updates
  const updateGaugeRuleField = (category: string, field: keyof GaugeConfig, value: number) => {
    setGaugeRules(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || { min: 0, max: 10, green_min: 0, green_max: 3 }),
        [field]: value
      }
    }))
  }

  // Helper to map UI structures to the flat format the backend expects
  const getBackendCategoryConfigs = () => {
    const configs: Record<string, any> = {}
    categoriesList.forEach((cat) => {
      const signalsList = signalsConfig[cat] || []
      const pass = passCriteria[cat] || { signal: '', value1: 3.0, operator1: '<', value2: 0.0, operator2: 'None', mask: 6.0 }
      
      const signalsMap: Record<string, any> = {}
      signalsList.forEach((sig) => {
        if (sig && sig.name) {
          signalsMap[sig.name] = {
            checked: !!sig.checked,
            operator: sig.operator || 'None',
            threshold: typeof sig.threshold === 'number' ? sig.threshold : 0.0,
            alias: sig.alias || sig.name
          }
        }
      })

      configs[cat] = {
        signals: signalsMap,
        pass_signal_name: pass.signal,
        mask_start: pass.mask,
        operator1: pass.operator1,
        value1: pass.value1,
        operator2: pass.operator2,
        value2: pass.value2
      }
    })
    return configs
  }

  // Report Preview triggers
  const triggerPreview = async () => {
    if (!analysisSelectedFile) {
      toast.error("Please select an MF4 file from the sidebar first")
      return
    }

    setIsPreviewLoading(true)

    try {
      const backendConfigs = getBackendCategoryConfigs()
      const res = await reportingApi.gazePreview({
        file_path: analysisSelectedFile,
        protocol,
        metadata: {
          oem_name: analysisOem,
          vehicle: analysisVehicle,
          engineer: analysisEngineer,
          analyst: analysisAnalyst,
          track: analysisTrack
        },
        category_configs: backendConfigs,
        gauge_rules: gaugeRules
      })

      if (res.data?.status === 'success' && res.data?.preview_path) {
        toast.success("Preview report generated successfully!")
        const url = `/api/analysis/media?path=${encodeURIComponent(res.data.preview_path)}`
        window.open(url, '_blank')
      } else {
        toast.error(res.data?.message || "Failed to generate preview report")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || "Error communicating with server")
    } finally {
      setIsPreviewLoading(false)
    }
  }

  // Batch Report Generation
  const triggerBatchGeneration = async () => {
    if (!analysisCheckedFiles || analysisCheckedFiles.length === 0) {
      toast.error("No files selected in sidebar tree checklist")
      return
    }

    setBatchRunning(true)
    setBatchProgress(0)
    setBatchLogs([])

    // Connect WebSocket to live logs
    const protocolWs = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocolWs}//${window.location.host}/api/reporting/ws`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'progress') {
          setBatchLogs(prev => [data.message, ...prev])
          setBatchProgress(prev => Math.min(95, prev + (100 / analysisCheckedFiles.length)))
        } else if (data.type === 'finished') {
          setBatchProgress(100)
          setBatchLogs(prev => [`[SUCCESS] ${data.message || 'Batch generation complete'}`, ...prev])
          toast.success(data.message || "All reports generated successfully!")
          setBatchRunning(false)
          ws.close()
        } else if (data.type === 'error') {
          setBatchLogs(prev => [`[ERROR] ${data.message}`, ...prev])
          toast.error(`Batch Error: ${data.message}`)
          setBatchRunning(false)
          ws.close()
        }
      } catch (e) {
        console.error(e)
      }
    }

    ws.onclose = () => {
      setBatchRunning(false)
    }

    try {
      const backendConfigs = getBackendCategoryConfigs()
      await reportingApi.gazeGenerate({
        files: analysisCheckedFiles,
        protocol,
        metadata: {
          oem_name: analysisOem,
          vehicle: analysisVehicle,
          engineer: analysisEngineer,
          analyst: analysisAnalyst,
          track: analysisTrack
        },
        category_configs: backendConfigs,
        gauge_rules: gaugeRules
      })
    } catch (err: any) {
      console.error(err)
      toast.error(err.response?.data?.message || "Failed to start batch generation")
      setBatchRunning(false)
      ws.close()
    }
  }

  const stopBatchGeneration = async () => {
    try {
      await reportingApi.stop()
      toast.info("Stopping generation...")
      if (wsRef.current) wsRef.current.close()
      setBatchRunning(false)
    } catch (err) {
      toast.error("Failed to request stop")
    }
  }

  const currentSignalsList = signalsConfig[activeCategory] || []
  const currentPassCriteria = passCriteria[activeCategory] || { signal: 'SoundPressure', value1: 3.0, operator1: '<', value2: 0.0, operator2: 'None', mask: 6.0 }

  // Filter signals list by query string
  const filteredSignals = currentSignalsList.filter(sig => {
    if (!sig || typeof sig.name !== 'string') return false
    const nameLower = sig.name.toLowerCase()
    const aliasLower = typeof sig.alias === 'string' ? sig.alias.toLowerCase() : nameLower
    const queryLower = filterQuery.toLowerCase()
    return nameLower.includes(queryLower) || aliasLower.includes(queryLower)
  })

  return (
    <div className="flex flex-col gap-6 p-6 animate-in fade-in duration-500 max-w-full w-full overflow-hidden">
      <style>{`
        @keyframes marquee-path {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-path {
          display: inline-block;
          white-space: nowrap;
          animation: marquee-path 14s linear infinite;
        }
      `}</style>

      {/* MAIN CONFIGURATION CARD */}
      <Card className="bg-surface-2/40 border-white/5 shadow-xl flex flex-col min-w-0 overflow-hidden">
        
        {/* MERGED CARD HEADER: Title, Scenario, Filter Bar, & Settings Dropdown */}
        <CardHeader className="pb-4 border-b border-white/5 bg-surface-3/60 backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-left">
            {/* Scenario selector Combobox with Radio buttons */}
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Scenario:</span>
              <div className="w-64">
                <SearchableSelect
                  value={activeCategory}
                  onChange={setActiveCategory}
                  placeholder="Select Scenario..."
                  items={categoriesList}
                  showRadio={true}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 self-end lg:self-auto">
            {/* Filter entry with hover clear 'x' button */}
            <div className="relative flex items-center shrink-0 group">
              <Input 
                placeholder="Filter signals..." 
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="h-9 w-[220px] bg-surface-3 border-white/10 text-sm pl-8 pr-8 rounded-lg placeholder:text-muted-foreground/60"
              />
              <Filter className="w-4 h-4 text-muted-foreground/60 absolute left-2.5 pointer-events-none" />
              {filterQuery && (
                <button 
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2.5 text-muted-foreground hover:text-white transition-opacity duration-150 p-0.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Loaded MF4 File Badge Indicator */}
            <div className="flex items-center">
              {loadedFiles[activeCategory] ? (
                <Badge 
                  variant="outline" 
                  className="h-9 px-3 bg-surface-3 hover:bg-surface-3/80 text-primary border-primary/20 text-xs font-semibold cursor-pointer select-none inline-flex items-center justify-center"
                  onClick={() => setFileSelectorOpen(true)}
                  title={loadedFiles[activeCategory]}
                >
                  <span className="truncate max-w-[140px] leading-none flex items-center justify-center h-full">
                    {loadedFiles[activeCategory].split(/[/\\]/).pop()}
                  </span>
                </Badge>
              ) : (
                <Badge 
                  variant="outline" 
                  className="h-9 px-3 bg-surface-3 hover:bg-surface-3/80 text-muted-foreground border-white/10 text-xs font-semibold cursor-pointer select-none inline-flex items-center justify-center"
                  onClick={() => setFileSelectorOpen(true)}
                >
                  <span className="leading-none flex items-center justify-center h-full">
                    No MF4 Loaded
                  </span>
                </Badge>
              )}
            </div>

            <div className="h-6 w-[1px] bg-white/10" />

            {/* Setup Actions Dropdown using GazeTimeTab style trigger button & menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0 bg-black/80 hover:bg-black/95 text-white border-white/10 rounded-lg shadow-xl backdrop-blur-md">
                  <Menu className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 bg-surface-2/40 border-white/5 text-white p-1 backdrop-blur-xl">
                <DropdownMenuLabel className="text-sm font-bold text-muted-foreground uppercase px-2.5 py-1.5 tracking-wider">Protocol</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuRadioGroup value={protocol} onValueChange={(val: any) => setProtocol(val)}>
                  <DropdownMenuRadioItem value="Euro NCAP" className="text-sm focus:bg-primary focus:text-black focus:font-bold">Euro NCAP</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="GSR ADDW" className="text-sm focus:bg-primary focus:text-black focus:font-bold">GSR ADDW</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                
                <DropdownMenuSeparator className="bg-white/5" />
                
                <DropdownMenuItem onClick={() => document.getElementById('import-config-input')?.click()} className="text-sm focus:bg-primary focus:text-black focus:font-bold gap-2 cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> Import JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportConfig} className="text-sm focus:bg-primary focus:text-black focus:font-bold gap-2 cursor-pointer">
                  <Save className="w-3.5 h-3.5" /> Save JSON
                </DropdownMenuItem>
                
                <DropdownMenuSeparator className="bg-white/5" />
                
                <DropdownMenuItem onClick={handleAutoLoadData} className="text-sm focus:bg-primary focus:text-black focus:font-bold gap-2 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" /> Auto-Load data
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => setGaugeRulesModalOpen(true)} className="text-sm focus:bg-primary focus:text-black focus:font-bold gap-2 cursor-pointer">
                  <Sliders className="w-3.5 h-3.5" /> Edit Gauge Limits
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Hidden Import Input */}
            <input 
              type="file" 
              id="import-config-input" 
              className="hidden" 
              accept=".json"
              onChange={handleImportConfig} 
            />
          </div>
        </CardHeader>
        
        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
          {/* Scrollable table with fixed height to prevent pushing buttons out of viewport */}
          <div className="h-[320px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="w-12 text-sm uppercase font-bold text-center h-10 sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">✓</TableHead>
                  <TableHead className="text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">Signal</TableHead>
                  <TableHead className="w-32 text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">Operator</TableHead>
                  <TableHead className="w-32 text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">Threshold</TableHead>
                  <TableHead className="text-sm uppercase font-bold h-10 tracking-wider sticky top-0 z-20 bg-surface-3/90 backdrop-blur-xl border-b border-white/5">Alias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignals.map((sig) => (
                  <TableRow key={sig.name} className="border-white/5 hover:bg-white/[0.02] transition-colors">
                    <TableCell className="py-2.5 text-center">
                      <Checkbox 
                        checked={sig.checked} 
                        onCheckedChange={(checked) => updateSignalField(activeCategory, sig.name, 'checked', !!checked)}
                        className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                    </TableCell>
                    <TableCell className="py-2.5 text-base font-semibold text-foreground/90">
                      {sig.name}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {sig.name === 'SoundPressure' ? (
                        <span className="text-sm text-muted-foreground/60 px-2 font-medium">Bandpass</span>
                      ) : (
                        <Select 
                          value={sig.operator} 
                          onValueChange={(val) => updateSignalField(activeCategory, sig.name, 'operator', val)}
                        >
                          <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2.5">
                            <SelectValue placeholder="Op" />
                          </SelectTrigger>
                          <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                            <SelectItem value="None" className="text-sm">None</SelectItem>
                            <SelectItem value=">" className="text-sm">&gt;</SelectItem>
                            <SelectItem value="<" className="text-sm">&lt;</SelectItem>
                            <SelectItem value=">=" className="text-sm">&gt;=</SelectItem>
                            <SelectItem value="<=" className="text-sm">&lt;=</SelectItem>
                            <SelectItem value="==" className="text-sm">==</SelectItem>
                            <SelectItem value="!=" className="text-sm">!=</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5">
                      {sig.name === 'SoundPressure' ? (
                        <span className="text-sm text-muted-foreground/60 text-center block">—</span>
                      ) : sig.operator === 'None' ? (
                        <span className="text-sm text-muted-foreground text-center block">-</span>
                      ) : (() => {
                        const cacheKey = `${loadedFiles[activeCategory] ?? ''}::${sig.name}`
                        const cachedVals = signalValuesCache[cacheKey]
                        if (cachedVals && cachedVals.length > 0) {
                          const hasVal = cachedVals.some(v => Math.abs(v - sig.threshold) < 1e-5)
                          const allVals = hasVal ? cachedVals : [sig.threshold, ...cachedVals].sort((a, b) => a - b)
                          return (
                            <Select
                              value={String(sig.threshold)}
                              onValueChange={(val) => updateSignalField(activeCategory, sig.name, 'threshold', parseFloat(val) || 0.0)}
                            >
                              <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2.5">
                                <SelectValue placeholder="Value" />
                              </SelectTrigger>
                              <SelectContent className="bg-surface-2/90 border-white/5 text-white backdrop-blur-xl text-sm max-h-48 overflow-y-auto">
                                {allVals.map(v => (
                                  <SelectItem key={v} value={String(v)} className="text-sm font-mono">{v}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )
                        }
                        return (
                          <Input
                            type="number"
                            value={sig.threshold}
                            onChange={(e) => updateSignalField(activeCategory, sig.name, 'threshold', parseFloat(e.target.value) || 0.0)}
                            className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-2.5"
                            step="0.1"
                          />
                        )
                      })()}
                    </TableCell>
                    <TableCell className="py-2.5">
                      <Input 
                        value={sig.alias} 
                        onChange={(e) => updateSignalField(activeCategory, sig.name, 'alias', e.target.value)}
                        className="h-8 bg-surface-3 border-white/5 text-sm rounded-lg px-2.5"
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSignals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                      {currentSignalsList.length === 0 ? "No signals configured for this category." : "No signals matched the filter query."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* BOTTOM SECTION: PASS CRITERIA CONFIG (Pass Criteria title & text-sm fields) */}
          <div className="bg-surface-3/60 backdrop-blur-md border-t border-white/5 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-1.5 text-left">
                <Activity className="w-4 h-4 text-primary" /> Pass Criteria
              </span>
              <HelpCircle 
                className="w-4 h-4 text-muted-foreground/60 hover:text-foreground cursor-help"
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3 text-sm text-foreground/80 font-medium text-left">
              <span className="text-muted-foreground whitespace-nowrap">The evaluation signal</span>
              <div className="w-[180px]">
                <Select 
                  value={currentPassCriteria.signal} 
                  onValueChange={(val) => updatePassCriteriaField(activeCategory, 'signal', val)}
                >
                  <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2">
                    <SelectValue placeholder="Signal" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                    {currentSignalsList.filter(s => s && typeof s.name === 'string').map(s => (
                      <SelectItem key={s.name} value={s.name} className="text-sm">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground whitespace-nowrap">must be</span>

              <div className="w-[85px]">
                <Select 
                  value={currentPassCriteria.operator1} 
                  onValueChange={(val) => updatePassCriteriaField(activeCategory, 'operator1', val)}
                >
                  <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2">
                    <SelectValue placeholder="Op1" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                    <SelectItem value="None" className="text-sm">None</SelectItem>
                    <SelectItem value=">" className="text-sm">&gt;</SelectItem>
                    <SelectItem value="<" className="text-sm">&lt;</SelectItem>
                    <SelectItem value=">=" className="text-sm">&gt;=</SelectItem>
                    <SelectItem value="<=" className="text-sm">&lt;=</SelectItem>
                    <SelectItem value="==" className="text-sm">==</SelectItem>
                    <SelectItem value="!=" className="text-sm">!=</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground whitespace-nowrap">than</span>

              <div className="w-[75px]">
                <Input 
                  type="number" 
                  value={currentPassCriteria.value1} 
                  onChange={(e) => updatePassCriteriaField(activeCategory, 'value1', parseFloat(e.target.value) || 0.0)}
                  className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-2"
                  step="0.1"
                />
              </div>

              <span className="text-muted-foreground whitespace-nowrap">and</span>

              <div className="w-[85px]">
                <Select 
                  value={currentPassCriteria.operator2} 
                  onValueChange={(val) => updatePassCriteriaField(activeCategory, 'operator2', val)}
                >
                  <SelectTrigger className="h-8 bg-surface-3 border-white/5 text-sm text-foreground rounded-lg px-2">
                    <SelectValue placeholder="Op2" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-2/40 border-white/5 text-white backdrop-blur-xl text-sm">
                    <SelectItem value="None" className="text-sm">None</SelectItem>
                    <SelectItem value=">" className="text-sm">&gt;</SelectItem>
                    <SelectItem value="<" className="text-sm">&lt;</SelectItem>
                    <SelectItem value=">=" className="text-sm">&gt;=</SelectItem>
                    <SelectItem value="<=" className="text-sm">&lt;=</SelectItem>
                    <SelectItem value="==" className="text-sm">==</SelectItem>
                    <SelectItem value="!=" className="text-sm">!=</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground whitespace-nowrap">than</span>

              <div className="w-[75px]">
                <Input 
                  type="number" 
                  value={currentPassCriteria.value2} 
                  onChange={(e) => updatePassCriteriaField(activeCategory, 'value2', parseFloat(e.target.value) || 0.0)}
                  className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-2"
                  step="0.1"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1.5 justify-between text-sm text-left">
              <div className="flex items-center gap-2">
                <span className="font-bold text-muted-foreground uppercase text-xs tracking-wider">Evaluation Mask Start:</span>
                <Input 
                  type="number" 
                  value={currentPassCriteria.mask} 
                  onChange={(e) => updatePassCriteriaField(activeCategory, 'mask', parseFloat(e.target.value) || 0.0)}
                  className="h-8 w-20 bg-surface-3 border-white/5 text-center text-sm rounded-lg"
                  step="0.1"
                />
                <span className="text-muted-foreground text-xs">seconds</span>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS ROW (Enlarged fonts & spaced icons) */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/5 p-4 bg-surface-3/10 gap-4">
            <div className="flex flex-col gap-1 align-start text-left w-full sm:w-auto">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Configuration targets</span>
              <div className="flex items-center gap-2 flex-wrap text-xs text-foreground/90 font-semibold mt-0.5">
                <span className="text-xs text-muted-foreground">Target Preview:</span>
                {analysisSelectedFile ? (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 max-w-[280px] truncate text-xs font-mono py-0.5 px-2 rounded-md">
                    {analysisSelectedFile.split('\\').pop()}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs italic font-normal">None selected (select from sidebar tree)</span>
                )}
                <span className="text-muted-foreground/30">|</span>
                <span className="text-xs text-muted-foreground">Batch count:</span>
                <Badge variant="outline" className="bg-white/5 text-muted-foreground border-white/10 text-xs font-mono py-0.5 px-2 rounded-md">
                  {analysisCheckedFiles.length} files
                </Badge>
              </div>
            </div>
            
            <div className="flex gap-2.5 w-full sm:w-auto shrink-0 justify-end">
              <Button
                onClick={triggerPreview}
                disabled={!analysisSelectedFile || isPreviewLoading}
                variant="outline"
                className="h-10 px-5 rounded-xl border-white/10 bg-surface-3 hover:bg-surface-4 text-foreground/90 hover:text-foreground font-bold uppercase text-xs tracking-widest gap-4 shadow-sm transition-all"
              >
                {isPreviewLoading ? (
                  <Clock className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 text-primary" />
                )}
                Preview Report
              </Button>
              
              {batchRunning ? (
                <Button
                  onClick={stopBatchGeneration}
                  variant="destructive"
                  className="h-10 px-5 rounded-xl font-bold uppercase text-xs tracking-widest gap-4 shadow-lg shadow-red-500/20"
                >
                  <AlertCircle className="w-4 h-4" />
                  Stop Batch
                </Button>
              ) : (
                <Button
                  onClick={triggerBatchGeneration}
                  disabled={analysisCheckedFiles.length === 0}
                  className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/95 text-black font-bold uppercase text-xs tracking-widest gap-4 shadow-lg shadow-primary/20 disabled:opacity-50 transition-all"
                >
                  <PlayCircle className="w-4 h-4" />
                  Run Batch ({analysisCheckedFiles.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BATCH PROGRESS & LOGS CONSOLE (Enlarged fonts) */}
      {(batchRunning || batchLogs.length > 0) && (
        <Card className="bg-surface-2/60 border-white/5 shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
          <CardHeader className="pb-2 bg-surface-3/20 border-b border-white/5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-bold uppercase text-foreground/90 flex items-center gap-2 text-left">
              <PlayCircle className="w-4 h-4 text-primary animate-pulse" /> Batch Execution Console
            </CardTitle>
            {batchRunning && (
              <Badge variant="outline" className="text-xs uppercase font-bold bg-primary/10 border-primary/20 text-primary animate-pulse py-0.5 px-2">
                Processing {Math.round(batchProgress)}%
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-4 flex flex-col gap-3">
            {batchRunning && (
              <Progress value={batchProgress} className="h-1.5 bg-white/5" />
            )}
            <div className="flex-1 flex flex-col overflow-hidden bg-black/40 border border-white/5 rounded-xl p-3.5 font-mono text-xs text-foreground/80 min-h-[180px] max-h-[300px]">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 text-left">Live Output Console</span>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-1 select-text">
                  {batchLogs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "whitespace-pre-wrap truncate text-left",
                        log.startsWith('[ERROR]') ? 'text-red-400 font-semibold' : log.startsWith('[SUCCESS]') ? 'text-green-400 font-semibold' : 'text-foreground/75'
                      )}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      )}

      {/* EDIT GLOBAL GAUGE RULES DIALOG MODAL */}
      <Dialog open={gaugeRulesModalOpen} onOpenChange={setGaugeRulesModalOpen}>
        <DialogContent className="bg-surface-2 border-white/10 text-foreground w-[480px] max-w-[95vw] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl p-0">
          <DialogHeader className="p-5 pb-3 border-b border-white/5 bg-surface-3/30">
            <DialogTitle className="text-sm font-bold uppercase text-foreground/90 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" /> Edit Gauge Rules (Matplotlib reports)
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-5 max-h-[50vh]">
            <div className="flex flex-col gap-4">
              {categoriesList.map((cat) => {
                const rule = gaugeRules[cat] || { min: 0, max: 10, green_min: 0, green_max: 3 }
                return (
                  <div key={cat} className="flex flex-col gap-2.5 p-3.5 bg-surface-3/20 border border-white/5 rounded-xl">
                    <span className="text-sm font-bold text-foreground/90 uppercase truncate text-left">{cat}</span>
                    <div className="grid grid-cols-4 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground text-left">Min (s)</label>
                        <Input 
                          type="number" 
                          value={rule.min} 
                          onChange={(e) => updateGaugeRuleField(cat, 'min', parseFloat(e.target.value) || 0)}
                          className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-1.5"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground text-left">Max (s)</label>
                        <Input 
                          type="number" 
                          value={rule.max} 
                          onChange={(e) => updateGaugeRuleField(cat, 'max', parseFloat(e.target.value) || 0)}
                          className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-1.5"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground text-left">Pass Min (s)</label>
                        <Input 
                          type="number" 
                          value={rule.green_min} 
                          onChange={(e) => updateGaugeRuleField(cat, 'green_min', parseFloat(e.target.value) || 0)}
                          className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-1.5"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground text-left">Pass Max (s)</label>
                        <Input 
                          type="number" 
                          value={rule.green_max} 
                          onChange={(e) => updateGaugeRuleField(cat, 'green_max', parseFloat(e.target.value) || 0)}
                          className="h-8 bg-surface-3 border-white/5 text-sm text-center rounded-lg px-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
          
          <div className="p-5 pt-3 border-t border-white/5 bg-surface-3/30 flex items-center justify-end">
            <Button 
              onClick={() => setGaugeRulesModalOpen(false)}
              className="h-8 bg-primary hover:bg-primary/95 text-black font-black uppercase text-[10px] tracking-widest rounded-lg px-4"
            >
              Apply Limits
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SELECT MF4 FILE DIALOG MODAL */}
      <Dialog open={fileSelectorOpen} onOpenChange={setFileSelectorOpen}>
        <DialogContent className="bg-surface-2 border-white/10 text-foreground w-[480px] max-w-[95vw] max-h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl p-0">
          <DialogHeader className="p-5 pb-3 border-b border-white/5 bg-surface-3/30 text-left">
            <DialogTitle className="text-sm font-bold uppercase text-foreground/90 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Select File for {activeCategory}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-4 border-b border-white/5 bg-surface-3/10">
            <div className="relative flex items-center group">
              <Input 
                placeholder="Search project MF4 files..." 
                value={fileSearchQuery}
                onChange={(e) => setFileSearchQuery(e.target.value)}
                className="h-9 w-full bg-surface-3 border-white/10 text-sm pl-8 pr-8 rounded-lg placeholder:text-muted-foreground/60"
              />
              <Filter className="w-4 h-4 text-muted-foreground/60 absolute left-2.5 pointer-events-none" />
              {fileSearchQuery && (
                <button 
                  onClick={() => setFileSearchQuery('')}
                  className="absolute right-2.5 text-muted-foreground hover:text-white transition-opacity duration-150 p-0.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto max-h-[45vh] scrollbar-thin">
            <div className="flex flex-col gap-1.5">
              {allParticipantMf4s.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">
                  No MF4 files detected. Try scanning a source path first.
                </div>
              ) : (
                (() => {
                  const filtered = allParticipantMf4s.filter(f => 
                    f.toLowerCase().includes(fileSearchQuery.toLowerCase())
                  )
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center text-xs text-muted-foreground py-8">
                        No matching files.
                      </div>
                    )
                  }
                  return filtered.map((filePath) => {
                    const isSelected = loadedFiles[activeCategory] === filePath
                    const fileName = filePath.split(/[/\\]/).pop() || filePath
                    return (
                      <button
                        key={filePath}
                        onClick={() => handleSelectFile(filePath)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border text-xs transition-all flex flex-col gap-1 overflow-hidden",
                          isSelected 
                            ? "bg-primary/10 border-primary/40 text-primary font-bold" 
                            : "bg-surface-3/15 border-white/5 hover:border-white/10 hover:bg-surface-3/30 text-foreground/80"
                        )}
                      >
                        <span className="truncate w-full font-medium">{fileName}</span>
                        <div
                          className="overflow-hidden w-full mt-0.5"
                          style={{
                            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                            maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)'
                          }}
                        >
                          <span className="animate-marquee-path text-[10px] text-muted-foreground/70">
                            {filePath}&ensp;&ensp;&ensp;&ensp;{filePath}
                          </span>
                        </div>
                      </button>
                    )
                  })
                })()
              )}
            </div>
          </div>
          
          <div className="p-4 pt-2.5 border-t border-white/5 bg-surface-3/30 flex items-center justify-end">
            <Button 
              variant="outline"
              onClick={() => setFileSelectorOpen(false)}
              className="h-8 border-white/10 hover:bg-white/5 text-foreground font-bold uppercase text-[10px] tracking-widest rounded-lg px-4"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
