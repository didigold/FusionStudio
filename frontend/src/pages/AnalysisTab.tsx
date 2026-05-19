import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAnalysisWS } from '../hooks/useAnalysisWS'
import { 
  ChevronRight, ChevronDown, Folder, File,
  LayoutGrid,
  ListChevronsUpDown, ListChevronsDownUp,
  Smile, Frown,
  Locate, LocateOff,
  FileChartColumnIncreasing,
  FileSearch,
  CheckSquare
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { SidebarProvider } from "@/components/ui/sidebar"

import { AudioTab } from '@/components/analysis/AudioTab'
import { TrackingTab } from '@/components/analysis/TrackingTab'
import { TimeSelectorTab } from '@/components/analysis/TimeSelectorTab'
import { LogicTab } from '@/components/analysis/LogicTab'
import { LogTab } from '@/components/analysis/LogTab'
import { AnalysisSidebar } from '@/components/analysis/AnalysisSidebar'
import { PlaceholderTab } from '@/components/analysis/PlaceholderTab'
import { MetadataTab } from '@/components/analysis/MetadataTab'

// --- PROGRESS RING COMPONENT ---
const ProgressRing = ({ value, max, title }: { value: number; max: number; title: string }) => {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const radius = 4.5
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percent / 100) * circumference

  let strokeColor = "stroke-amber-500"
  if (percent === 100) {
    strokeColor = "stroke-emerald-500"
  } else if (percent === 0) {
    strokeColor = "stroke-red-500/20"
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

// --- TREE NODE COMPONENT ---
function RecordingNode({ 
  node, 
  level = 0, 
  selectedPath, 
  onSelect,
  checkedFiles,
  onToggleCheck,
  expandedAll
}: { 
  node: any, 
  level?: number, 
  selectedPath: string | null, 
  onSelect: (path: string) => void,
  checkedFiles: string[],
  onToggleCheck: (path: string) => void,
  expandedAll: boolean | null
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Sync expansion with global toggle
  useEffect(() => {
    if (expandedAll !== null && node.type !== 'file') {
      setIsExpanded(expandedAll)
    }
  }, [expandedAll, node.type])

  const hasChildren = node.children && node.children.length > 0
  const isChecked = node.type === 'file' ? checkedFiles.includes(node.path) : false

  if (node.type === 'file') {
    return (
      <div 
        className={cn(
          "flex items-center justify-between p-1.5 hover:bg-surface-3 rounded-lg cursor-pointer group transition-all mb-0.5",
          selectedPath === node.path ? "bg-primary/20 ring-1 ring-primary/30" : "text-foreground/80"
        )}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
        onClick={() => onSelect(node.path)}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <div onClick={(e) => { e.stopPropagation(); onToggleCheck(node.path); }}>
             <Checkbox 
               checked={isChecked} 
               className="w-3.5 h-3.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary" 
             />
          </div>
          <File className={cn("w-3.5 h-3.5 shrink-0", selectedPath === node.path ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-sm font-medium truncate", selectedPath === node.path && "text-primary font-bold")}>{node.name}</span>
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          <Badge 
            variant={node.has_tracking ? "success" : "destructive"} 
            className="p-0 w-[18px] h-[18px] border-0 flex items-center justify-center rounded-md"
            title={node.has_tracking ? "Tracking Completed" : "Tracking Pending"}
          >
            {node.has_tracking ? <Smile className="w-3.5 h-3.5" /> : <Frown className="w-3.5 h-3.5" />}
          </Badge>
          <Badge 
            variant={node.has_marks ? "success" : "destructive"} 
            className="p-0 w-[18px] h-[18px] border-0 flex items-center justify-center rounded-md"
            title={node.has_marks ? "Marks Completed" : "Marks Pending"}
          >
            {node.has_marks ? <Locate className="w-3.5 h-3.5" /> : <LocateOff className="w-3.5 h-3.5" />}
          </Badge>
          <Badge 
            variant={node.has_report ? "success" : "destructive"} 
            className="p-0 w-[18px] h-[18px] border-0 flex items-center justify-center rounded-md"
            title={node.has_report ? "Report Completed" : "Report Pending"}
          >
            {node.has_report ? <FileChartColumnIncreasing className="w-3.5 h-3.5" /> : <File className="w-3.5 h-3.5" />}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-1.5 hover:bg-surface-3 rounded-lg cursor-pointer group transition-all mb-0.5"
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-4 h-4 flex items-center justify-center">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
          <Folder className="w-3.5 h-3.5 text-primary/60 shrink-0" />
          <span className="text-sm font-bold text-foreground/90 truncate">{node.name}</span>
        </div>
        {!isExpanded && node.tracking_stats && (
           <div className="flex items-center gap-1.5 shrink-0 select-none">
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
                checkedFiles={checkedFiles}
                onToggleCheck={onToggleCheck}
                expandedAll={expandedAll}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnalysisTab() {
  const {
    analysisSourcePath, setAnalysisSourcePath,
    analysisResults, setAnalysisResults,
    analysisSelectedFile, setAnalysisSelectedFile,
    analysisCheckedFiles, toggleAnalysisFile, setAllAnalysisFiles,
    analysisExpandedAll, setAnalysisExpandedAll,
    setAnalysisAvailableCameras,
    addLog
  } = useAppStore()

  useAnalysisWS()

  const [selectionType, setSelectionType] = useState('all')
  const [activeTab, setActiveTab] = useState('audio')

  const selectFile = (filePath: string) => {
    setAnalysisSelectedFile(filePath)
  }

  const totalMF4Count = useMemo(() => 
    analysisResults.reduce((acc, res) => acc + (res.tracking_stats?.[1] || 0), 0), 
    [analysisResults]
  )

  const handleSelectionChange = (val: string) => {
    setSelectionType(val)
    if (val === 'all') setAllAnalysisFiles(true)
    else setAllAnalysisFiles(false)
  }

  const isAllExpanded = analysisExpandedAll === true

  const toggleExpand = () => {
    setAnalysisExpandedAll(!isAllExpanded)
  }

  return (
    <div className="flex h-full gap-6 p-1 overflow-hidden">
      <div className="w-80 flex flex-col gap-6 overflow-hidden">
        {/* Participant Status Panel */}
        <div className="bg-card/50 border border-border/50 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
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

          <ScrollArea className="flex-1 bg-[#121211]/30 scroll-fade-mask">
            <div className="flex flex-col gap-0.5 p-2">
              {analysisResults.map((res, i) => (
                <RecordingNode 
                  key={i} 
                  node={res} 
                  selectedPath={analysisSelectedFile} 
                  onSelect={selectFile} 
                  checkedFiles={analysisCheckedFiles}
                  onToggleCheck={toggleAnalysisFile}
                  expandedAll={analysisExpandedAll}
                />
              ))}
              {analysisResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-20">
                  <FileSearch className="w-12 h-12 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground tracking-tight">No recordings found</p>
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
      </div>

      {/* Main Analysis Panel (Sidebar + Content) */}
      <div className="flex-1 bg-card/50 border border-border/50 rounded-xl flex overflow-hidden shadow-sm relative min-h-0">
        <SidebarProvider defaultOpen className="h-full w-full flex overflow-hidden min-h-0">
          <AnalysisSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 flex flex-col overflow-hidden bg-[#121211]">
            {['time-selector', 'tracking'].includes(activeTab) ? (
              <>
                {activeTab === 'tracking' && <TrackingTab />}
                {activeTab === 'time-selector' && <TimeSelectorTab />}
              </>
            ) : (
              <ScrollArea className="flex-1">
                {activeTab === 'audio' && <AudioTab selectedFile={analysisSelectedFile} />}
                {activeTab === 'metadata' && <MetadataTab />}
                {activeTab === 'logic' && <LogicTab />}
                {activeTab === 'occupant-time' && <PlaceholderTab label="Misuse Time" />}
                {activeTab === 'misuse-logic' && <PlaceholderTab label="Misuse Logic" />}
                {activeTab === 'classification' && <PlaceholderTab label="Classification" />}
                {activeTab === 'reporting' && <PlaceholderTab label="Reporting" />}
                {activeTab === 'log' && <LogTab />}
              </ScrollArea>
            )}
          </div>
        </SidebarProvider>
      </div>
    </div>
  )
}