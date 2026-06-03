import { useState, useEffect, useMemo, memo, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAnalysisWS } from '../hooks/useAnalysisWS'
import { useFuseWebSocket } from '../hooks/useFuseWebSocket'
import { useClassifyWS } from '../hooks/useClassifyWS'
import { 
  ChevronRight, ChevronDown, Folder, File,
  ListChevronsUpDown, ListChevronsDownUp,
  Smile, Frown,
  Locate, LocateOff,
  FileChartColumnIncreasing,
  FileSearch,
  CheckSquare,
  LayoutGrid
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { SidebarProvider } from "@/components/ui/sidebar"
import { motion, AnimatePresence } from 'framer-motion'

import { AudioTab } from '@/components/analysis/AudioTab'
import { TrackingTab } from '@/components/analysis/TrackingTab'
import { GazeTimeTab } from '@/components/analysis/GazeTimeTab'
import { GazeLogicTab } from '@/components/analysis/GazeLogicTab'
import { LogTab } from '@/components/analysis/LogTab'
import { AnalysisSidebar } from '@/components/analysis/AnalysisSidebar'
import { PlaceholderTab } from '@/components/analysis/PlaceholderTab'
import { MetadataTab } from '@/components/analysis/MetadataTab'
import ClassificationTab from './ClassificationTab'
import ReportingTab from './ReportingTab'
import FuseTab from './FuseTab'
import BrainTab from './HuMindTab'

// --- PROGRESS RING COMPONENT ---
const ProgressRing = ({ value, max, title }: { value: number; max: number; title: string }) => {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const radius = 4.5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = 0

  let strokeColor = "stroke-amber-500"
  if (percent === 100) {
    strokeColor = "stroke-emerald-500"
  } else if (percent === 0) {
    strokeColor = "stroke-red-500"
  }

  return (
    <div className="relative flex items-center justify-center w-3.5 h-3.5" title={`${title}: ${value}/${max}`}>
      <svg className="w-3.5 h-3.5 transform -rotate-90">
        <circle
          cx="7"
          cy="7"
          r={radius}
          className="stroke-white/5 fill-transparent"
          strokeWidth="1.5"
        />
        <circle
          cx="7"
          cy="7"
          r={radius}
          className={cn("fill-transparent transition-all duration-500", strokeColor)}
          strokeWidth="1.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

interface FileFolderRipple {
  key: number
  x: number
  y: number
  size: number
}

const getAllFilesUnderNode = (node: any): string[] => {
  let files: string[] = []
  if (node.type === 'file') {
    files.push(node.path)
  }
  if (node.children) {
    for (const child of node.children) {
      files = files.concat(getAllFilesUnderNode(child))
    }
  }
  return files
}

// Memoized tree node — only re-renders when its own props change
const RecordingNode = memo(function RecordingNode({ 
  node, 
  level = 0, 
  selectedPath, 
  onSelect,
  checkedFilesSet,
  onToggleCheck,
  onToggleFolder,
  expandedAll
}: { 
  node: any, 
  level?: number, 
  selectedPath: string | null, 
  onSelect: (path: string) => void,
  checkedFilesSet: Set<string>,
  onToggleCheck: (path: string) => void,
  onToggleFolder: (node: any) => void,
  expandedAll: boolean | null
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [ripples, setRipples] = useState<FileFolderRipple[]>([])
  
  // Sync expansion with global toggle
  useEffect(() => {
    if (expandedAll !== null && node.type !== 'file') {
      setIsExpanded(expandedAll)
    }
  }, [expandedAll, node.type])

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    const rect = container.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = event.clientX - rect.left - size / 2
    const y = event.clientY - rect.top - size / 2

    const newRipple: FileFolderRipple = {
      key: Date.now() + Math.random(),
      x,
      y,
      size,
    }

    setRipples((prev) => [...prev, newRipple])
  }

  const handleAnimationEnd = (key: number) => {
    setRipples((prev) => prev.filter((ripple) => ripple.key !== key))
  }

  const hasChildren = node.children && node.children.length > 0
  // O(1) lookup using Set instead of O(N) array.includes()
  const isChecked = node.type === 'file' ? checkedFilesSet.has(node.path) : false

  // For parent nodes (folders/participants)
  const nestedFiles = useMemo(() => {
    if (node.type === 'file') return []
    return getAllFilesUnderNode(node)
  }, [node])

  const checkedNestedCount = useMemo(() => {
    if (node.type === 'file') return 0
    return nestedFiles.filter(f => checkedFilesSet.has(f)).length
  }, [nestedFiles, checkedFilesSet])

  const isAllChecked = nestedFiles.length > 0 && checkedNestedCount === nestedFiles.length
  const isIndeterminate = checkedNestedCount > 0 && checkedNestedCount < nestedFiles.length
  const isFolderChecked = isAllChecked ? true : (isIndeterminate ? "indeterminate" : false)

  if (node.type === 'file') {
    return (
      <div 
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", node.path)
        }}
        className={cn(
          "flex items-center justify-between p-1.5 hover:bg-surface-3 rounded-lg cursor-pointer group transition-all mb-0.5 relative overflow-hidden",
          selectedPath === node.path ? "bg-primary/20 ring-1 ring-primary/30" : "text-foreground/80"
        )}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={(e) => {
          createRipple(e)
          onSelect(node.path)
        }}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 relative z-10">
          <div onClick={(e) => { e.stopPropagation(); onToggleCheck(node.path); }}>
             <Checkbox 
               checked={isChecked} 
               className="w-3.5 h-3.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
             />
          </div>
          <File className={cn("w-3.5 h-3.5 shrink-0", selectedPath === node.path ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium truncate", selectedPath === node.path && "text-primary font-bold")}>{node.name}</span>
        </div>
        <div className="flex gap-1 shrink-0 ml-2 relative z-10">
          <Badge 
            key={`tracking-${node.has_tracking}`}
            variant={node.has_tracking ? "success" : "destructive"} 
            className={cn("p-0 w-[18px] h-[18px] border-0 flex items-center justify-center rounded-md transition-all duration-300", node.has_tracking && "animate-badge-pop")}
            title={node.has_tracking ? "Tracking Completed" : "Tracking Pending"}
          >
            {node.has_tracking ? <Smile className="w-3.5 h-3.5" /> : <Frown className="w-3.5 h-3.5" />}
          </Badge>
          <Badge 
            key={`marks-${node.has_marks}`}
            variant={node.has_marks ? "success" : "destructive"} 
            className={cn("p-0 w-[18px] h-[18px] border-0 flex items-center justify-center rounded-md transition-all duration-300", node.has_marks && "animate-badge-pop")}
            title={node.has_marks ? "Marks Completed" : "Marks Pending"}
          >
            {node.has_marks ? <Locate className="w-3.5 h-3.5" /> : <LocateOff className="w-3.5 h-3.5" />}
          </Badge>
          <Badge 
            key={`report-${node.has_report}`}
            variant={node.has_report ? "success" : "destructive"} 
            className={cn("p-0 w-[18px] h-[18px] border-0 flex items-center justify-center rounded-md transition-all duration-300", node.has_report && "animate-badge-pop")}
            title={node.has_report ? "Report Completed" : "Report Pending"}
          >
            {node.has_report ? <FileChartColumnIncreasing className="w-3.5 h-3.5" /> : <File className="w-3.5 h-3.5" />}
          </Badge>
        </div>

        {ripples.map((ripple) => (
          <span
            key={ripple.key}
            className="absolute rounded-full bg-white/20 pointer-events-none animate-ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.x,
              top: ripple.y,
            }}
            onAnimationEnd={() => handleAnimationEnd(ripple.key)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div 
        onClick={(e) => {
          createRipple(e)
          setIsExpanded(!isExpanded)
        }}
        className="flex items-center justify-between p-1.5 hover:bg-surface-3 rounded-lg cursor-pointer group transition-all mb-0.5 relative overflow-hidden"
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
      >
        <div className="flex items-center gap-2 overflow-hidden relative z-10 flex-1">
          <div className="w-4 h-4 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          {nestedFiles.length > 0 && (
            <div onClick={(e) => { e.stopPropagation(); onToggleFolder(node); }}>
               <Checkbox 
                 checked={isFolderChecked} 
                 className="w-3.5 h-3.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
               />
            </div>
          )}
          <Folder className="w-3.5 h-3.5 text-primary/60 shrink-0" />
          <span className="text-sm font-bold text-foreground/90 truncate">{node.name}</span>
        </div>
        {!isExpanded && node.tracking_stats && (
           <div className="flex items-center gap-1.5 shrink-0 select-none relative z-10">
             <div className="flex gap-1 items-center bg-surface-3/30 border border-white/5 px-1.5 py-0.5 rounded-md">
               <ProgressRing value={node.tracking_stats[0]} max={node.tracking_stats[1]} title="Tracking" />
               <ProgressRing value={node.marks_stats?.[0] || 0} max={node.marks_stats?.[1] || 0} title="Marks" />
               <ProgressRing value={node.analysis_stats?.[0] || 0} max={node.analysis_stats?.[1] || 0} title="Reports" />
             </div>
             <span className="text-xs font-bold text-muted-foreground/80 bg-surface-3/50 border border-white/5 rounded-md w-[32px] h-[20px] flex items-center justify-center shrink-0">
               {node.tracking_stats[1]}
             </span>
           </div>
        )}

        {ripples.map((ripple) => (
          <span
            key={ripple.key}
            className="absolute rounded-full bg-white/20 pointer-events-none animate-ripple"
            style={{
              width: ripple.size,
              height: ripple.size,
              left: ripple.x,
              top: ripple.y,
            }}
            onAnimationEnd={() => handleAnimationEnd(ripple.key)}
          />
        ))}
      </div>
      {hasChildren && (
        <div 
          className={cn(
            "grid transition-all duration-200 ease-in-out",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden flex flex-col">
            {node.children.map((child: any, idx: number) => (
              <RecordingNode 
                key={idx} 
                node={child} 
                level={level + 1} 
                selectedPath={selectedPath} 
                onSelect={onSelect}
                checkedFilesSet={checkedFilesSet}
                onToggleCheck={onToggleCheck}
                onToggleFolder={onToggleFolder}
                expandedAll={expandedAll}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}) // end memo(RecordingNode)

export default function AnalysisTab() {
  const {
    analysisResults,
    analysisSelectedFile, setAnalysisSelectedFile,
    analysisCheckedFiles, toggleAnalysisFile, setAllAnalysisFiles,
    analysisExpandedAll, setAnalysisExpandedAll,
  } = useAppStore()

  useAnalysisWS()
  useFuseWebSocket()
  useClassifyWS()

  const [selectionType, setSelectionType] = useState('all')
  const [activeTab, setActiveTab] = useState('audio')

  // Stable callback — won't invalidate memoized RecordingNode children
  const selectFile = useCallback((filePath: string) => {
    setAnalysisSelectedFile(filePath)
  }, [setAnalysisSelectedFile])

  // O(1) lookup set — rebuilt only when the array reference changes
  const checkedFilesSet = useMemo(() => new Set(analysisCheckedFiles), [analysisCheckedFiles])

  const totalMF4Count = useMemo(() => 
    analysisResults.reduce((acc, res) => acc + (res.tracking_stats?.[1] || 0), 0), 
    [analysisResults]
  )

  const handleSelectionChange = useCallback((val: string) => {
    setSelectionType(val)
    if (val === 'all') setAllAnalysisFiles(true)
    else setAllAnalysisFiles(false)
  }, [setAllAnalysisFiles])

  const isAllExpanded = analysisExpandedAll === true

  const toggleExpand = useCallback(() => {
    setAnalysisExpandedAll(!isAllExpanded)
  }, [setAnalysisExpandedAll, isAllExpanded])

  const toggleFolder = useCallback((node: any) => {
    const files = getAllFilesUnderNode(node)
    const allChecked = files.every(f => checkedFilesSet.has(f))
    let nextChecked: string[]
    if (allChecked) {
      nextChecked = analysisCheckedFiles.filter(f => !files.includes(f))
    } else {
      const toAdd = files.filter(f => !analysisCheckedFiles.includes(f))
      nextChecked = [...analysisCheckedFiles, ...toAdd]
    }
    useAppStore.setState({ analysisCheckedFiles: nextChecked })
  }, [analysisCheckedFiles, checkedFilesSet])

  const SHOW_RECORDINGS_TABS = ['audio', 'metadata', 'tracking', 'time-selector', 'logic', 'occupant-time', 'misuse-logic'];
  const shouldShowRecordings = SHOW_RECORDINGS_TABS.includes(activeTab);

  return (
    <div className="flex h-full gap-0 p-1 overflow-hidden">
      <AnimatePresence initial={false}>
        {shouldShowRecordings && (
          <motion.div
            initial={{ width: 0, opacity: 0, marginRight: 0 }}
            animate={{ width: 320, opacity: 1, marginRight: 24 }}
            exit={{ width: 0, opacity: 0, marginRight: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="flex flex-col gap-6 overflow-hidden shrink-0"
          >
            {/* Participant Status Panel */}
            <div className="bg-card/50 border border-border/50 rounded-3xl flex-1 overflow-hidden flex flex-col shadow-sm">
              <div className="p-4 border-b border-white/5 bg-surface-2/30">
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-primary" />
                      <span className="text-sm font-bold tracking-tight text-foreground">Recordings</span>
                   </div>
                   <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-6 h-6 hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={toggleExpand}
                        title={isAllExpanded ? "Collapse All" : "Expand All"}
                      >
                        {isAllExpanded ? <ListChevronsDownUp className="w-3.5 h-3.5" /> : <ListChevronsUpDown className="w-3.5 h-3.5" />}
                      </Button>
                   </div>
                </div>

                {/* Radio Selection Group */}
                <RadioGroup 
                  value={selectionType} 
                  onValueChange={handleSelectionChange}
                  className="flex gap-x-3 gap-y-2"
                >
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'none', label: 'None' },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center space-x-1.5">
                      <RadioGroupItem value={item.id} id={`r-${item.id}`} className="w-3 h-3 border-white/20" />
                      <Label htmlFor={`r-${item.id}`} className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <ScrollArea className="flex-1 bg-background/30 scroll-fade-mask relative">
                <div className={cn("flex flex-col gap-0.5 p-2", analysisResults.length === 0 && "h-full min-h-[350px] justify-center items-center")}>
                  {analysisResults.map((res, i) => (
                    <RecordingNode 
                      key={i} 
                      node={res} 
                      selectedPath={analysisSelectedFile} 
                      onSelect={selectFile} 
                      checkedFilesSet={checkedFilesSet}
                      onToggleCheck={toggleAnalysisFile}
                      onToggleFolder={toggleFolder}
                      expandedAll={analysisExpandedAll}
                    />
                  ))}
                  {analysisResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-4 select-none w-full relative">
                      {/* Ambient glow circle */}
                      <div className="absolute w-[180px] h-[180px] rounded-full bg-white/[0.02] blur-[40px] pointer-events-none" />
                      
                      <div className="w-16 h-16 rounded-full border border-border dark:border-white/5 flex items-center justify-center animate-pulse-sync mb-1">
                        <FileSearch className="w-6 h-6 stroke-[1.2] text-foreground" />
                      </div>
                      <div className="text-center space-y-1.5 animate-pulse-sync">
                        <p className="text-sm tracking-[0.2em] font-extrabold uppercase text-foreground">
                          No recordings found
                        </p>
                        <p className="text-xs uppercase tracking-wider opacity-60 font-mono text-muted-foreground">
                          Enter a valid source path to scan
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-3 border-t border-white/5 bg-surface-2/30 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-bold text-primary tracking-tight">
                      {analysisCheckedFiles.length} selected
                    </span>
                 </div>
                 <span className="text-xs font-medium text-muted-foreground tracking-tight opacity-50">
                    Total: {totalMF4Count} MF4
                 </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Analysis Panel (Sidebar + Content) */}
      <div className="flex-1 bg-card/50 border border-border/50 rounded-3xl flex overflow-hidden shadow-sm relative min-h-0">
        <SidebarProvider defaultOpen className="h-full w-full flex overflow-hidden min-h-0">
          <AnalysisSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <AnimatePresence mode="wait">
              {activeTab === 'tracking' && (
                <motion.div
                  key="tracking"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <TrackingTab />
                </motion.div>
              )}
              {activeTab === 'time-selector' && (
                <motion.div
                  key="time-selector"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <GazeTimeTab />
                </motion.div>
              )}
              {activeTab === 'logic' && (
                <motion.div
                  key="logic"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <GazeLogicTab />
                </motion.div>
              )}
              {activeTab === 'fuse' && (
                <motion.div
                  key="fuse"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <FuseTab />
                </motion.div>
              )}
              {activeTab === 'audio' && (
                <motion.div
                  key="audio"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <AudioTab selectedFile={analysisSelectedFile} />
                </motion.div>
              )}
              {activeTab === 'metadata' && (
                <motion.div
                  key="metadata"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <MetadataTab />
                </motion.div>
              )}
              {activeTab === 'occupant-time' && (
                <motion.div
                  key="occupant-time"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <ScrollArea className="flex-1">
                    <PlaceholderTab label="Misuse Time" />
                  </ScrollArea>
                </motion.div>
              )}
              {activeTab === 'misuse-logic' && (
                <motion.div
                  key="misuse-logic"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <ScrollArea className="flex-1">
                    <PlaceholderTab label="Misuse Logic" />
                  </ScrollArea>
                </motion.div>
              )}
              {activeTab === 'classification' && (
                <motion.div
                  key="classification"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <ClassificationTab />
                </motion.div>
              )}
              {activeTab === 'reporting' && (
                <motion.div
                  key="reporting"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <ReportingTab />
                </motion.div>
              )}
              {activeTab === 'models' && (
                <motion.div
                  key="models"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <BrainTab />
                </motion.div>
              )}
              {activeTab === 'log' && (
                <motion.div
                  key="log"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="h-full w-full min-h-0 overflow-hidden flex flex-col"
                >
                  <LogTab />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </SidebarProvider>
      </div>
    </div>
  )
}