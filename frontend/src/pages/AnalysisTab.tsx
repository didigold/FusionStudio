import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAnalysisWS } from '../hooks/useAnalysisWS'
import { 
  FileSearch,
  Loader2,
  ChevronRight, ChevronDown, Folder, File,
  RefreshCw, LayoutGrid, FolderOpen,
  ChevronUp, CheckSquare
} from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
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
import { FolderBrowser } from '@/components/analysis/FolderBrowser'

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
            className="px-1 py-0 h-3.5 text-[8px] font-bold border-0 min-w-[14px] flex justify-center"
          >T</Badge>
          <Badge 
            variant={node.has_marks ? "success" : "destructive"} 
            className="px-1 py-0 h-3.5 text-[8px] font-bold border-0 min-w-[14px] flex justify-center"
          >M</Badge>
          <Badge 
            variant={node.has_report ? "success" : "destructive"} 
            className="px-1 py-0 h-3.5 text-[8px] font-bold border-0 min-w-[14px] flex justify-center"
          >R</Badge>
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
           <Badge variant="secondary" className="px-1.5 py-0 h-4 text-xs font-bold bg-surface-3 text-muted-foreground border-border/50">
             {node.tracking_stats[1]}
           </Badge>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div className="flex flex-col">
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

  const [scanning, setScanning] = useState(false)
  const [selectionType, setSelectionType] = useState('all')
  const [activeTab, setActiveTab] = useState('audio')
  const [browseOpen, setBrowseOpen] = useState(false)

  const handleFolderSelect = (path: string) => {
    setAnalysisSourcePath(path)
  }

  const handleScan = async () => {
    if (!analysisSourcePath) return
    setScanning(true)
    try {
      const res = await fetch('/api/analysis/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: analysisSourcePath }),
      })
      const data = await res.json()
      setAnalysisResults(data.results || [])
      setAnalysisAvailableCameras(data.available_cameras || [])
      if (selectionType === 'all') setAllAnalysisFiles(true)
      addLog(`Analysis scan found ${data.results?.length || 0} participants.`)
    } catch (err) { addLog(`Error scanning analysis dir: ${err}`) }
    finally { setScanning(false) }
  }

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
        {/* Data Source Panel */}
        <div className="bg-card/50 border border-border/50 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSearch className="text-primary w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground tracking-tight">Data source</h2>
              <p className="text-xs text-muted-foreground tracking-tight">Select project directory</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex w-full gap-0">
              <Input
                value={analysisSourcePath}
                onChange={(e) => setAnalysisSourcePath(e.target.value)}
                placeholder="C:\Path\To\Project..."
                className="rounded-r-none border-r-0 h-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setBrowseOpen(true)}
                className="rounded-l-none border border-white/5 bg-surface-3 h-9 w-9 p-0 shrink-0 hover:bg-surface-2 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
              </Button>
            </div>
            <Button onClick={handleScan} disabled={scanning} className="w-full bg-primary text-background rounded-lg font-bold text-sm tracking-tight hover:bg-primary/90 shadow-lg shadow-primary/10 h-9">
              {scanning ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
              {scanning ? 'Scanning...' : 'Scan directory'}
            </Button>
          </div>
        </div>

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
                    {isAllExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
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

          <ScrollArea className="flex-1 p-2 bg-[#121211]/30">
            <div className="flex flex-col gap-0.5">
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
      <div className="flex-1 bg-card/50 border border-border/50 rounded-xl flex overflow-hidden shadow-sm relative">
        <SidebarProvider defaultOpen>
          <AnalysisSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 bg-[#121211]">
              {activeTab === 'audio' && <AudioTab selectedFile={analysisSelectedFile} />}
              {activeTab === 'metadata' && <PlaceholderTab label="Metadata" />}
              {activeTab === 'tracking' && <TrackingTab />}
              {activeTab === 'time-selector' && <TimeSelectorTab />}
              {activeTab === 'logic' && <LogicTab />}
              {activeTab === 'occupant-time' && <PlaceholderTab label="Misuse Time" />}
              {activeTab === 'misuse-logic' && <PlaceholderTab label="Misuse Logic" />}
              {activeTab === 'classification' && <PlaceholderTab label="Classification" />}
              {activeTab === 'reporting' && <PlaceholderTab label="Reporting" />}
              {activeTab === 'log' && <LogTab />}
            </ScrollArea>
          </div>
        </SidebarProvider>
      </div>
      <FolderBrowser open={browseOpen} onOpenChange={setBrowseOpen} onSelect={handleFolderSelect} />
    </div>
  )
}