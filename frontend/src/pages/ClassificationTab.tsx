import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { 
  Tags, FolderSearch, Settings, PlayCircle, Square,
  CheckCircle2, AlertCircle, FileText, Calendar, Building, Hash, Activity, Hourglass,
  ChevronDown, ChevronRight, ListChevronsUpDown, ListChevronsDownUp,
  Box, Image, Film
} from 'lucide-react'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function ClassificationTab() {
  const {
    analysisSourcePath,
    classifyOutputPath, setClassifyOutputPath,
    classifyYear, setClassifyYear,
    classifyOem, setClassifyOem,
    classifyRef, setClassifyRef,
    classifyProtocol, setClassifyProtocol,
    classifyReportPdf, setClassifyReportPdf,
    classifyGroups, setClassifyGroups,
    classifyToggleFile,
    classifyProcessing, setClassifyProcessing,
    classifyProgress, setClassifyProgress,
    setClassifyStatus,
    addLog
  } = useAppStore()

  const [previewNames, setPreviewNames] = useState<Record<string, string>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({})

  // Generate official names whenever groups or metadata change
  useEffect(() => {
    if (classifyGroups.length === 0) return
    const previews: Record<string, string> = {}

    classifyGroups.forEach((g: any) => {
      g.files.forEach((f: any) => {
        const key = f.path
        const ref = classifyRef || '0000'
        const nc_code = g.nc_code || `UNDEF_${f.case_key}`
        const proposed = `${ref}-${nc_code}_${String(f.attempt).padStart(2, '0')}`
        previews[key] = proposed
      })
    })
    setPreviewNames(previews)
  }, [classifyGroups, classifyRef])

  // Automatically scan the navbar directory if groups are empty on mount or when directory changes
  useEffect(() => {
    if (analysisSourcePath && classifyGroups.length === 0 && !classifyProcessing) {
      handleScan()
    }
  }, [analysisSourcePath, classifyGroups.length, classifyProcessing])

  // Stable dependency key for checking if file paths or nc_codes have changed
  const filesKey = useMemo(() => {
    return classifyGroups.map((g: any) => 
      `${g.nc_code || ''}:${(g.files || []).map((f: any) => `${f.path}:${f.attempt}`).join(',')}`
    ).join(';');
  }, [classifyGroups])

  // Check completed cases on output path or metadata changes
  useEffect(() => {
    if (classifyGroups.length === 0 || !classifyOutputPath.trim() || classifyProcessing) return

    const year = classifyYear || 'YY'
    const oem = classifyOem || 'OEM'
    const ref = classifyRef || 'REF'
    const protocol = classifyProtocol || 'DSM'
    const projectRoot = `${classifyOutputPath}\\${year}-${oem}-${ref}-${protocol}`

    const items: any[] = []
    classifyGroups.forEach((g: any) => {
      g.files?.forEach((f: any) => {
        const refCode = classifyRef || '0000'
        const nc_code = g.nc_code || `UNDEF_${f.case_key}`
        const proposedName = `${refCode}-${nc_code}_${String(f.attempt).padStart(2, '0')}`
        items.push({
          item_ref: f.path,
          case_full_name: proposedName
        })
      })
    })

    if (items.length === 0) return

    const check = async () => {
      try {
        const res = await fetch('/api/classification/check-completed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_root: projectRoot, items }),
        })
        const data = await res.json()
        
        const latestGroups = useAppStore.getState().classifyGroups
        let hasChanges = false
        const updated = latestGroups.map((g: any) => {
          let groupChanged = false
          const updatedFiles = g.files?.map((f: any) => {
            const status = data.results?.[f.path]
            if (status && f.status !== 'running' && f.status !== status) {
              groupChanged = true
              hasChanges = true
              return { ...f, status }
            }
            return f
          }) || []
          if (groupChanged) {
            return { ...g, files: updatedFiles }
          }
          return g
        })
        
        if (hasChanges) {
          setClassifyGroups(updated)
        }
      } catch (err) {
        console.error("Error checking completed:", err)
      }
    }

    const timer = setTimeout(check, 300)
    return () => clearTimeout(timer)
  }, [filesKey, classifyOutputPath, classifyYear, classifyOem, classifyRef, classifyProtocol, classifyProcessing])

  const handleScan = async () => {
    if (!analysisSourcePath) return
    setClassifyStatus('Scanning...')
    try {
      const res = await fetch('/api/classification/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: analysisSourcePath }),
      })
      const data = await res.json()
      setClassifyGroups(data.groups || [])
      setExpandedGroups({}) // Reset expansion state on new scan
      addLog(`Classification scan found ${data.groups?.length || 0} groups in ${analysisSourcePath}.`)
      setClassifyStatus('Scan complete.')
    } catch (err) {
      addLog(`Error scanning directory: ${err}`)
      setClassifyStatus('Error during scan.')
    }
  }

  const handleProcessAll = async () => {
    if (!classifyOutputPath.trim()) { addLog('Please set an output directory.'); return }

    const year = classifyYear || 'YY'
    const oem = classifyOem || 'OEM'
    const ref = classifyRef || 'REF'
    const protocol = classifyProtocol || 'DSM'
    const projectRoot = `${classifyOutputPath}\\${year}-${oem}-${ref}-${protocol}`

    const tasks: any[] = []
    classifyGroups.forEach((g: any) => {
      g.files.forEach((f: any) => {
        if (f.checked) {
          const proposedName = previewNames[f.path] || f.filename
          tasks.push({
            data: { path: f.path, filename: f.filename },
            case_full_name: proposedName,
            item_ref: f.path,
          })
        }
      })
    })

    if (tasks.length === 0) { addLog('No files selected.'); return }

    setClassifyProcessing(true)
    setClassifyProgress(0)
    setClassifyStatus('Running...')
    addLog(`Starting classification of ${tasks.length} files to ${projectRoot}`)

    try {
      const res = await fetch('/api/classification/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          project_root: projectRoot,
          meta: { year, oem, ref, protocol },
          report_pdf_path: classifyReportPdf,
        }),
      })
      const data = await res.json()
      if (data.status === 'already_running') { setClassifyProcessing(false); addLog('Already running.'); }
      else if (data.status === 'error') { setClassifyProcessing(false); addLog(`Error: ${data.message}`); }
    } catch (err: any) { setClassifyProcessing(false); addLog(`Error: ${err.message}`) }
  }

  const handleStop = async () => {
    setClassifyProcessing(false)
    setClassifyStatus('Stopped')
    await fetch('/api/classification/stop', { method: 'POST' })
    addLog('Stop requested.')
  }

  const toggleGroupExpanded = (gIdx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedGroups(prev => ({
      ...prev,
      [gIdx]: !prev[gIdx]
    }))
  }

  const toggleGroupChecked = (gIdx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const group = classifyGroups[gIdx]
    const allChecked = group.files.every((f: any) => f.checked)
    const updatedGroups = [...classifyGroups]
    updatedGroups[gIdx] = {
      ...group,
      files: group.files.map((f: any) => ({ ...f, checked: !allChecked }))
    }
    setClassifyGroups(updatedGroups)
  }

  // Check if all groups are currently expanded
  const allExpanded = useMemo(() => {
    if (classifyGroups.length === 0) return false
    return classifyGroups.every((_, idx) => expandedGroups[idx])
  }, [classifyGroups, expandedGroups])

  const handleToggleAllExpanded = () => {
    const nextState: Record<number, boolean> = {}
    if (!allExpanded) {
      classifyGroups.forEach((_, idx) => {
        nextState[idx] = true
      })
    }
    setExpandedGroups(nextState)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar Config */}
      <div className="w-80 border-r border-white/5 bg-surface-1/40 flex flex-col p-6 gap-6 overflow-y-auto custom-scrollbar shrink-0">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Settings className="text-primary w-5 h-5" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Protocol Config</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Year</label>
              <input type="text" maxLength={2} value={classifyYear} onChange={(e) => setClassifyYear(e.target.value.toUpperCase())} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none uppercase font-semibold text-foreground" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> OEM</label>
              <input type="text" maxLength={3} value={classifyOem} onChange={(e) => setClassifyOem(e.target.value.toUpperCase())} placeholder="Ex: BMW" className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none uppercase font-semibold text-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Reference</label>
            <input type="text" maxLength={4} value={classifyRef} onChange={(e) => setClassifyRef(e.target.value)} placeholder="Ex: 1001" className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none font-semibold text-foreground" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Protocol</label>
            <select value={classifyProtocol} onChange={(e) => setClassifyProtocol(e.target.value)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none appearance-none font-semibold text-foreground">
              <option value="DSM">EuroNCAP DSM</option>
              <option value="ADDW">EuroNCAP ADDW</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Report PDF</label>
            <input type="text" value={classifyReportPdf} onChange={(e) => setClassifyReportPdf(e.target.value)} placeholder="Path to report PDF..." className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none font-semibold text-foreground" />
          </div>
        </div>

        <div className="h-px bg-white/5" />

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <FolderSearch className="text-primary w-5 h-5" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Paths</h2>
          </div>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">OUTPUT DIRECTORY</span>
              <input type="text" value={classifyOutputPath} onChange={(e) => setClassifyOutputPath(e.target.value)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-xs focus:outline-none font-medium text-foreground" />
            </div>
            <button onClick={handleScan} className="w-full bg-surface-ink border border-border/50 text-foreground rounded-lg py-2.5 font-bold text-xs hover:bg-surface-3 transition-all mt-2 uppercase tracking-wide">
              REFRESH DIRECTORY
            </button>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-surface-2/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2.5 rounded-full">
              <Tags className="text-primary w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">File Classification</h2>
              <p className="text-xs text-muted-foreground">Map raw MF4 files to NCAP official naming conventions.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              disabled={classifyGroups.length === 0}
              className="w-6 h-6 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={handleToggleAllExpanded}
              title={allExpanded ? "Collapse All" : "Expand All"}
            >
              {allExpanded ? <ListChevronsDownUp className="w-3.5 h-3.5" /> : <ListChevronsUpDown className="w-3.5 h-3.5" />}
            </Button>
            {!classifyProcessing ? (
              <button 
                onClick={handleProcessAll} 
                disabled={classifyGroups.length === 0} 
                className="bg-primary text-background w-44 h-10 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50 text-xs"
              >
                <PlayCircle className="w-4 h-4" /> PROCESS ALL
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="bg-destructive text-destructive-foreground w-44 h-10 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-destructive/90 transition-all text-xs">
                      <Square className="w-4 h-4" /> STOP
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro de que deseas detener el proceso?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción detendrá la clasificación actual. Las tareas incompletas no se procesarán.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleStop} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Detener
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>

        {/* Groups Container: stretched to edge (no p-6 padding) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-white/5">
          {classifyGroups.length > 0 ? classifyGroups.map((group: any, gIdx: number) => {
            const isExpanded = !!expandedGroups[gIdx]
            const groupChecked = group.files?.every((f: any) => f.checked) ?? false
            const groupSomeChecked = (group.files?.some((f: any) => f.checked) ?? false) && !groupChecked

            return (
              <div key={gIdx} className="w-full flex flex-col">
                {/* Group Header Row */}
                <div 
                  onClick={(e) => toggleGroupExpanded(gIdx, e)}
                  className="w-full p-4 bg-surface-2/15 hover:bg-surface-2/30 flex items-center cursor-pointer transition-colors select-none border-b border-white/5"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* shadcn style checkbox for group toggle */}
                    <div 
                      onClick={(e) => toggleGroupChecked(gIdx, e)}
                      className={cn(
                        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 flex items-center justify-center",
                        groupChecked 
                          ? "bg-primary text-primary-foreground" 
                          : groupSomeChecked
                            ? "bg-primary/50 border-primary"
                            : "border-border hover:border-primary/50"
                      )}
                    >
                      {groupChecked && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-background">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      {groupSomeChecked && (
                        <div className="w-2 h-0.5 bg-background rounded-sm" />
                      )}
                    </div>

                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}

                    <span className="text-sm font-bold text-foreground uppercase tracking-wider w-32 shrink-0">{group.case_key || group.name}</span>
                    <div className="w-24 shrink-0 flex items-center">
                      <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase whitespace-nowrap">
                        {group.files?.length || 0} {(group.files?.length || 0) === 1 ? 'FILE' : 'FILES'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium hidden md:inline truncate flex-1">{group.description}</span>
                  </div>
                </div>

                {/* File list (with framer-motion animation) */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="w-full divide-y divide-border/20 bg-surface-2/5 overflow-hidden"
                    >
                      {group.files?.map((file: any, fIdx: number) => (
                        <div 
                          key={fIdx} 
                          onClick={() => classifyToggleFile(gIdx, fIdx)} 
                          className="w-full p-4 pl-12 flex items-center justify-between hover:bg-primary/5 cursor-pointer select-none transition-colors"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            {/* shadcn style checkbox for file toggle */}
                            <div 
                              className={cn(
                                "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 flex items-center justify-center",
                                file.checked 
                                  ? "bg-primary text-primary-foreground" 
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              {file.checked && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-background">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>

                            <div className="flex flex-col">
                              <span className="text-xs font-mono text-muted-foreground">{file.filename.replace('_tracking', '')}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-bold text-primary">
                                  {previewNames[file.path] || 'Calculating...'}
                                </span>
                                <div className="flex items-center gap-1.5 ml-2">
                                  {/* Box (MF4) */}
                                  <span 
                                    className="inline-flex items-center justify-center rounded-md p-1 size-6 bg-emerald-500/10 text-emerald-400"
                                    title="MF4 file present"
                                  >
                                    <Box className="w-4 h-4" />
                                  </span>

                                  {/* Image (Report) */}
                                  <span 
                                    className={cn(
                                      "inline-flex items-center justify-center rounded-md p-1 size-6 transition-colors",
                                      file.has_report ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                    )}
                                    title={file.has_report ? "Report plots present" : "Report plots missing"}
                                  >
                                    <Image className="w-4 h-4" />
                                  </span>

                                  {/* Film (Video) */}
                                  <span 
                                    className={cn(
                                      "inline-flex items-center justify-center rounded-md p-1 size-6 transition-colors",
                                      file.has_video ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                    )}
                                    title={file.has_video ? "Video recording present" : "Video recording missing"}
                                  >
                                    <Film className="w-4 h-4" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-8">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">NCAP CODE</span>
                              <span className="text-sm font-bold text-foreground">{group.nc_code || '---'}</span>
                            </div>
                            <div className="w-6 flex justify-center">
                              {file.status === 'done' ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : file.status === 'error' ? (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              ) : (
                                <Hourglass className="w-3.5 h-3.5 text-primary/50" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          }) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-24 opacity-30 select-none">
              <Tags className="w-16 h-16" />
              <p className="text-base font-semibold">Select a loaded folder to preview classifications.</p>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {classifyProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-3">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${classifyProgress}%` }} />
          </div>
        )}
      </div>
    </div>

  )
}