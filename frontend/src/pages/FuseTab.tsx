import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useFuseWebSocket } from '../hooks/useFuseWebSocket'
import { 
  Play, Pause, Square, Box, Clapperboard, Crown, File,
  RefreshCw, Filter, ChevronRight, ChevronDown, Check, ChevronsUpDown
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export default function FuseTab() {
  const { 
    analysisSourcePath,
    participants, setParticipants,
    toggleParticipant, setAllParticipants,
    signals, setSignals, toggleSignal, setAllSignals,
    masterFile, setMasterFile,
    fusionState, setFusionState,
    addLog,
    copyVideos, setCopyVideos,
    overwriteMode, setOverwriteMode,
    signalFilter, setSignalFilter
  } = useAppStore()

  useFuseWebSocket()

  const [scanning, setScanning] = useState(false)
  const [loadingSignals, setLoadingSignals] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [comboboxOpen, setComboboxOpen] = useState(false)

  const allChecked = participants.length > 0 && participants.every(p => p.checked)
  const noneChecked = participants.length > 0 && participants.every(p => !p.checked)
  const radioValue = allChecked ? 'all' : (noneChecked ? 'none' : '')

  const handleSelectionChange = (val: string) => {
    if (val === 'all') {
      setAllParticipants(true)
    } else if (val === 'none') {
      setAllParticipants(false)
    }
  }

  const allSignalsChecked = signals.length > 0 && signals.every(s => s.checked)
  const noneSignalsChecked = signals.length > 0 && signals.every(s => !s.checked)
  const signalsRadioValue = allSignalsChecked ? 'all' : (noneSignalsChecked ? 'none' : '')

  const handleSignalsSelectionChange = (val: string) => {
    if (val === 'all') {
      setAllSignals(true)
    } else if (val === 'none') {
      setAllSignals(false)
    }
  }

  const toggleExpanded = (name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleScan = async (path: string) => {
    if (!path) return
    setScanning(true)
    addLog(`Scanning root folder: ${path}`)
    try {
      const res = await fetch('/api/fuse/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: path }),
      })
      const data = await res.json()
      setParticipants((data.participants || []).map((p: any) => ({ ...p, checked: true })))
      addLog(`Found ${data.participants?.length || 0} participants.`)
    } catch (err) {
      addLog(`Error scanning: ${err}`)
    } finally {
      setScanning(false)
    }
  }

  const handleLoadSignals = async (filePath: string) => {
    if (!filePath) return
    setLoadingSignals(true)
    addLog(`Loading signals from master: ${filePath}`)
    try {
      const res = await fetch('/api/fuse/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath }),
      })
      const data = await res.json()
      setSignals((data.channels || []).map((ch: any) => ({ ...ch, checked: true })))
      addLog(`Loaded ${data.channels?.length || 0} signals.`)
    } catch (err) {
      addLog(`Error loading signals: ${err}`)
    } finally {
      setLoadingSignals(false)
    }
  }

  const handleRun = async () => {
    const selectedParticipants = participants.filter(p => p.checked).map(p => p.name)
    const selectedSignals = signals.filter(s => s.checked).map(s => ({ name: s.name, g_idx: s.g_idx, c_idx: s.c_idx }))
    
    if (selectedParticipants.length === 0) {
      addLog('No participants selected.')
      return
    }
    
    setFusionState('running')
    addLog(`Starting fusion for ${selectedParticipants.length} participants...`)
    
    try {
      await fetch('/api/fuse/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_dir: analysisSourcePath,
          participants: selectedParticipants,
          signal_whitelist: selectedSignals.length > 0 ? selectedSignals : null,
          copy_videos: copyVideos,
          overwrite_mode: overwriteMode
        })
      })
    } catch (err) {
      addLog(`Error starting fusion: ${err}`)
      setFusionState('idle')
    }
  }

  const handlePause = async () => {
    try {
      await fetch('/api/fuse/pause', { method: 'POST' })
      setFusionState('paused')
      addLog('Pause requested.')
    } catch (err) {
      addLog(`Error pausing: ${err}`)
    }
  }

  const handleResume = async () => {
    try {
      await fetch('/api/fuse/resume', { method: 'POST' })
      setFusionState('running')
      addLog('Resume requested.')
    } catch (err) {
      addLog(`Error resuming: ${err}`)
    }
  }

  const handleStop = async () => {
    try {
      await fetch('/api/fuse/stop', { method: 'POST' })
      setFusionState('stopping')
      addLog('Stop requested.')
    } catch (err) {
      addLog(`Error stopping: ${err}`)
    }
  }

  // Trigger participant scan when analysisSourcePath changes
  useEffect(() => {
    if (analysisSourcePath) {
      handleScan(analysisSourcePath)
    }
  }, [analysisSourcePath])

  // Dynamically extract all master files from selected participants
  const masterFilesList = useMemo(() => {
    const list: { name: string; path: string }[] = []
    const seen = new Set<string>()
    participants.forEach(p => {
      if (p.checked && p.masters) {
        p.masters.forEach((m: any) => {
          const name = typeof m === 'object' ? m.name : m
          const path = typeof m === 'object' ? m.path : `${p.path}/${m}`
          if (!seen.has(path)) {
            seen.add(path)
            list.push({ name, path })
          }
        })
      }
    })
    return list
  }, [participants])

  // Automatically select the first available master file when the selection updates
  useEffect(() => {
    if (masterFilesList.length > 0) {
      const exists = masterFilesList.some(m => m.path === masterFile)
      if (!exists) setMasterFile(masterFilesList[0].path)
    } else {
      setMasterFile('')
    }
  }, [masterFilesList, masterFile, setMasterFile])

  // Load signals automatically when masterFile changes
  useEffect(() => {
    if (masterFile) {
      handleLoadSignals(masterFile)
    } else {
      setSignals([])
    }
  }, [masterFile])

  const filteredSignals = signals.filter(s => 
    s.name.toLowerCase().includes(signalFilter.toLowerCase())
  )

  const parseStatus = (statusText: string) => {
    if (!statusText) return { files: null, vids: null }
    const filesMatch = statusText.match(/(\d+\/\d+)\s+files/i)
    const vidsMatch = statusText.match(/(\d+\/\d+)\s+vids/i)
    return {
      files: filesMatch ? filesMatch[1] : null,
      vids: vidsMatch ? vidsMatch[1] : null
    }
  }

  return (
    <div className="flex h-full overflow-hidden divide-x divide-border bg-background">

      {/* ───── Left Column: Processing Sandbox ───── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex justify-between items-center bg-surface-2/30 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">Processing Sandbox</span>
            <span className="text-xs bg-surface-3 px-2 py-0.5 rounded-full text-muted-foreground tabular-nums">
              {participants.filter(p => p.checked).length} / {participants.length}
            </span>
            <button
              onClick={() => handleScan(analysisSourcePath)}
              disabled={scanning || !analysisSourcePath}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors disabled:opacity-50"
              title="Rescan project folder"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <RadioGroup 
            value={radioValue} 
            onValueChange={handleSelectionChange}
            className="flex items-center gap-x-3"
          >
            {[
              { id: 'all', label: 'All' },
              { id: 'none', label: 'None' },
            ].map((item) => (
              <div key={item.id} className="flex items-center space-x-1.5">
                <RadioGroupItem value={item.id} id={`r-${item.id}`} className="w-3 h-3 border-white/20" />
                <Label htmlFor={`r-${item.id}`} className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                  {item.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Column Headers */}
        <div className="flex items-center pl-4 pr-4 py-2 bg-surface-2 text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border shrink-0">
          <div className="w-6 shrink-0" />   {/* checkbox space */}
          <div className="w-7 shrink-0" />   {/* chevron space */}
          <div className="flex-1 font-medium pl-1">Participant</div>
          <div className="w-48 font-medium">Status</div>
          <div className="w-28 font-medium">Progress</div>
        </div>

        {/* Participant List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {participants.map((p) => {
            const isExpanded = expanded.has(p.name)
            const parsed = parseStatus(p.status_text)
            const hasMasters = p.masters && p.masters.length > 0
            const hasSatellites = p.satellites && p.satellites.length > 0
            const hasChildren = hasMasters || hasSatellites

            return (
              <div key={p.name} className="border-b border-border/30 last:border-0">

                {/* Main Row */}
                <div
                  className={`flex items-center pl-4 pr-4 py-2.5 cursor-pointer hover:bg-primary/5 transition-colors select-none ${p.checked ? 'bg-primary/[0.02]' : ''}`}
                  onClick={(e) => toggleExpanded(p.name, e)}
                >
                  {/* Checkbox — consistent with Recordings panel */}
                  <div className="w-6 shrink-0 flex items-center" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={p.checked}
                      onCheckedChange={() => toggleParticipant(p.name)}
                      className="w-3.5 h-3.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </div>

                  {/* Expand/Collapse Chevron */}
                  <div
                    className="w-7 shrink-0 flex items-center justify-center"
                    onClick={e => toggleExpanded(p.name, e)}
                  >
                    {hasChildren ? (
                      isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                    ) : (
                      <div className="w-3.5 h-3.5" /> // empty placeholder
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 font-medium text-foreground pl-1 text-sm">{p.name}</div>

                  {/* Status badges */}
                  <div className="w-48">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#666' }} />
                      {p.status_text === 'No Data' ? (
                        <span className="text-sm text-muted-foreground font-semibold">No Data</span>
                      ) : (
                        <div className="flex items-center gap-2.5 text-muted-foreground">
                          {parsed.files && (
                            <div className="flex items-center gap-1.5 w-14 shrink-0" title="Satellite files fused">
                              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded dark:bg-muted-foreground/25 shrink-0">
                                <Box className="w-3.5 h-3.5 text-muted-foreground/70 dark:text-foreground/80" />
                              </span>
                              <span className="text-sm font-mono">{parsed.files}</span>
                            </div>
                          )}
                          {parsed.vids && (
                            <div className="flex items-center gap-1.5 w-14 shrink-0" title="Tracking videos">
                              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded dark:bg-muted-foreground/25 shrink-0">
                                <Clapperboard className="w-3.5 h-3.5 text-muted-foreground/70 dark:text-foreground/80" />
                              </span>
                              <span className="text-sm font-mono">{parsed.vids}</span>
                            </div>
                          )}
                          {hasMasters && (
                            <div className="flex items-center gap-1.5 w-10 shrink-0" title={`${p.masters.length} master file(s)`}>
                              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded dark:bg-amber-500/30 shrink-0">
                                <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                              </span>
                              <span className="text-sm font-mono">{p.masters.length}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-28">
                    <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-500"
                        style={{ width: `${p.progress || 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Expanded detail section ── */}
                {isExpanded && (
                  <div className="border-t border-border/20 bg-surface-1/30">

                    {/* Masters */}
                    {hasMasters && (
                      <div>
                        <div className="flex items-center gap-1.5 pl-[52px] pr-4 py-1.5 bg-amber-500/5 border-b border-amber-500/10">
                          <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded dark:bg-amber-500/30 shrink-0">
                            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                          </span>
                          <span className="text-sm font-bold uppercase tracking-wider text-amber-500/70">
                            Master Files — {p.masters.length}
                          </span>
                        </div>
                        {p.masters.map((m: any) => {
                          const mName = typeof m === 'object' ? m.name : m
                          const mPath = typeof m === 'object' ? m.path : m
                          return (
                            <div
                              key={mPath}
                              className="flex items-center gap-2 pl-[60px] pr-4 py-1 hover:bg-amber-500/5 transition-colors"
                            >
                              <File className="w-3.5 h-3.5 text-amber-500/40 shrink-0" />
                              <span className="text-xs text-amber-400/70 font-mono truncate">{mName}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Satellites */}
                    {hasSatellites && (
                      <div>
                        <div className="flex items-center gap-1.5 pl-[52px] pr-4 py-1.5 bg-surface-3/10 border-b border-border/10 border-t border-border/10">
                          <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded dark:bg-muted-foreground/25 shrink-0">
                            <Box className="w-3.5 h-3.5 text-muted-foreground/50 dark:text-foreground/80" />
                          </span>
                          <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground/50">
                            Satellite Files — {p.satellites.length}
                          </span>
                        </div>
                        <div className="grid grid-cols-2">
                          {p.satellites.map((s: string) => (
                            <div
                              key={s}
                              className="flex items-center gap-1.5 pl-[60px] pr-4 py-[3px] hover:bg-surface-3/20 transition-colors"
                            >
                              <File className="w-3 h-3 text-muted-foreground/25 shrink-0" />
                              <span className="text-xs text-muted-foreground/40 font-mono truncate">{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Empty state */}
          {participants.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-3 select-none">
              <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center opacity-40">
                <Box className="w-5 h-5" />
              </div>
              <p className="text-xs text-muted-foreground/50 font-mono uppercase tracking-wider">
                No participants found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ───── Right Column: Signal Config & Actions ───── */}
      <div className="flex flex-col w-96 overflow-hidden divide-y divide-border shrink-0 bg-surface-1/10">

        {/* Signal Selection */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-border bg-surface-2/30">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-bold text-foreground">Signals</span>
              {loadingSignals && <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            <div className="flex flex-col gap-3">
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    disabled={loadingSignals || masterFilesList.length === 0}
                    className="w-full justify-between bg-surface-3 border border-border/50 text-xs text-foreground hover:bg-surface-3/80 h-9 font-normal px-3"
                  >
                    <span className="truncate flex-1 text-left">
                      {masterFile
                        ? (masterFilesList.find(m => m.path === masterFile)?.name || masterFile.split(/[/\\]/).pop())
                        : "Select a Master MF4..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 bg-popover border border-border" align="start">
                  <Command>
                    <CommandInput placeholder="Search Master MF4..." className="text-xs" />
                    <CommandList className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      <CommandEmpty className="text-xs text-muted-foreground p-3">No master files found.</CommandEmpty>
                      <CommandGroup>
                        {masterFilesList.map((m) => (
                          <CommandItem
                            key={m.path}
                            value={m.name + " " + m.path}
                            onSelect={() => {
                              setMasterFile(m.path)
                              setComboboxOpen(false)
                            }}
                            className="text-xs text-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground px-3 py-2 flex items-center justify-between"
                          >
                            <span className="truncate flex-1">
                              {m.name} ({m.path.split(/[/\\]/).slice(-2, -1)[0]})
                            </span>
                            <Check
                              className={cn(
                                "ml-2 h-3.5 w-3.5 shrink-0",
                                masterFile === m.path ? "opacity-100" : "opacity-0"
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter signals..."
                  value={signalFilter}
                  onChange={e => setSignalFilter(e.target.value)}
                  className="w-full bg-surface-3 border border-border/50 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Signals column header */}
          <div className="p-3 bg-surface-2/30 border-b border-border flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-6 shrink-0">
            <span>Name</span>
            <RadioGroup 
              value={signalsRadioValue} 
              onValueChange={handleSignalsSelectionChange}
              className="flex items-center gap-x-3"
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'none', label: 'None' },
              ].map((item) => (
                <div key={item.id} className="flex items-center space-x-1.5">
                  <RadioGroupItem value={item.id} id={`sig-r-${item.id}`} className="w-3 h-3 border-white/20" />
                  <Label htmlFor={`sig-r-${item.id}`} className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors">
                    {item.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Signals list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredSignals.map(sig => (
              <div
                key={sig.name}
                onClick={() => toggleSignal(sig.name)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-3 cursor-pointer group"
              >
                <span className="text-xs text-foreground truncate flex-1 pr-2">{sig.name}</span>
                <div onClick={e => e.stopPropagation()}>
                  <Checkbox
                    checked={sig.checked}
                    onCheckedChange={() => toggleSignal(sig.name)}
                    className="w-3.5 h-3.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </div>
              </div>
            ))}
            {filteredSignals.length === 0 && (
              <div className="text-xs text-muted-foreground italic p-4 text-center">No signals loaded.</div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="p-6 bg-surface-2/10 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <div
                onClick={() => setCopyVideos(!copyVideos)}
                className={`w-10 h-5 rounded-full relative transition-colors ${copyVideos ? 'bg-primary' : 'bg-surface-3'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${copyVideos ? 'left-6' : 'left-1'}`} />
              </div>
              <span className="text-xs font-medium text-foreground">Copy Tracking Videos</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group select-none">
              <div
                onClick={() => setOverwriteMode(!overwriteMode)}
                className={`w-10 h-5 rounded-full relative transition-colors ${overwriteMode ? 'bg-primary' : 'bg-surface-3'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${overwriteMode ? 'left-6' : 'left-1'}`} />
              </div>
              <span className="text-xs font-medium text-foreground">Overwrite Existing</span>
            </label>
          </div>

          <div className="pt-2 flex gap-2">
            {fusionState === 'idle' && (
              <button
                onClick={handleRun}
                disabled={participants.filter(p => p.checked).length === 0}
                className="w-full bg-primary text-background rounded-lg py-4 font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
              >
                <Play className="w-5 h-5 fill-current" />
                START FUSION
              </button>
            )}
            {fusionState === 'running' && (
              <>
                <button
                  onClick={handlePause}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-background rounded-lg py-4 font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Pause className="w-5 h-5 fill-current" />
                  PAUSE
                </button>
                <button
                  onClick={handleStop}
                  className="bg-destructive text-destructive-foreground rounded-lg py-4 px-6 font-bold flex items-center justify-center gap-2 hover:bg-destructive/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Square className="w-5 h-5 fill-current" />
                  STOP
                </button>
              </>
            )}
            {fusionState === 'paused' && (
              <>
                <button
                  onClick={handleResume}
                  className="flex-1 bg-primary text-background rounded-lg py-4 font-bold flex items-center justify-center gap-2 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Play className="w-5 h-5 fill-current" />
                  RESUME
                </button>
                <button
                  onClick={handleStop}
                  className="bg-destructive text-destructive-foreground rounded-lg py-4 px-6 font-bold flex items-center justify-center gap-2 hover:bg-destructive/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Square className="w-5 h-5 fill-current" />
                  STOP
                </button>
              </>
            )}
            {fusionState === 'stopping' && (
              <button
                disabled
                className="w-full bg-surface-3 text-muted-foreground border border-border/50 rounded-lg py-4 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className="w-5 h-5 animate-spin" />
                STOPPING...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
