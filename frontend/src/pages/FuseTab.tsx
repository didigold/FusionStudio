import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useFuseWebSocket } from '../hooks/useFuseWebSocket'
import { 
  Search, FolderOpen, Play,
  RefreshCw, Trash2, CheckSquare, Square as SquareIcon,
  AlertCircle, CheckCircle2, Filter
} from 'lucide-react'

export default function FuseTab() {
  const { 
    sourcePath, setSourcePath,
    participants, setParticipants,
    toggleParticipant, setAllParticipants, setIncompleteParticipants,
    signals, setSignals, toggleSignal, setAllSignals,
    masterFile, setMasterFile,
    fusionState, setFusionState,
    logs, addLog, clearLogs,
    copyVideos, setCopyVideos,
    overwriteMode, setOverwriteMode,
    signalFilter, setSignalFilter
  } = useAppStore()

  useFuseWebSocket()

  const [scanning, setScanning] = useState(false)
  const [loadingSignals, setLoadingSignals] = useState(false)

  const handleScan = async () => {
    if (!sourcePath) return
    setScanning(true)
    addLog(`Scanning root folder: ${sourcePath}`)
    try {
      const res = await fetch('/api/fuse/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: sourcePath }),
      })
      const data = await res.json()
      setParticipants(data.participants || [])
      addLog(`Found ${data.participants?.length || 0} participants.`)
    } catch (err) {
      addLog(`Error scanning: ${err}`)
    } finally {
      setScanning(false)
    }
  }

  const handleLoadSignals = async () => {
    if (!masterFile) return
    setLoadingSignals(true)
    addLog(`Loading signals from master: ${masterFile}`)
    try {
      const res = await fetch('/api/fuse/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: masterFile }),
      })
      const data = await res.json()
      setSignals((data.channels || []).map((ch: any) => ({ ...ch, checked: false })))
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
          source_dir: sourcePath,
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

  const filteredSignals = signals.filter(s => 
    s.name.toLowerCase().includes(signalFilter.toLowerCase())
  )

  return (
    <div className="flex h-full gap-6 p-1 overflow-hidden">
      {/* Left Column: Config & List */}
      <div className="flex flex-col flex-1 gap-6 overflow-hidden">
        
        {/* Source Selection */}
        <div className="bg-card/50 border border-border/50 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-primary/10 p-2 rounded-full">
              <FolderOpen className="text-primary w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Project Source</h2>
          </div>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="Scan a root folder to find project..."
              className="flex-1 bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button 
              onClick={handleScan}
              disabled={scanning || !sourcePath}
              className="bg-primary text-background px-6 py-2 rounded-lg font-bold text-sm hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Scan
            </button>
          </div>
        </div>

        {/* Participants Table */}
        <div className="bg-card/50 border border-border/50 rounded-3xl flex-1 overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border/50 flex justify-between items-center bg-surface-2/30">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Participants</span>
              <span className="text-xs bg-surface-3 px-2 py-0.5 rounded-full text-muted-foreground">
                {participants.filter(p => p.checked).length} / {participants.length}
              </span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setAllParticipants(true)}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider"
              >
                All
              </button>
              <span className="text-border">|</span>
              <button 
                onClick={() => setIncompleteParticipants()}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider"
              >
                Incomplete
              </button>
              <span className="text-border">|</span>
              <button 
                onClick={() => setAllParticipants(false)}
                className="text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider"
              >
                None
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface-2 text-[11px] text-muted-foreground uppercase tracking-wider z-10">
                <tr>
                  <th className="px-4 py-3 font-medium w-10"></th>
                  <th className="px-4 py-3 font-medium">Participant Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium w-32">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {participants.map((p) => (
                  <tr 
                    key={p.name}
                    onClick={() => toggleParticipant(p.name)}
                    className={`group cursor-pointer hover:bg-primary/5 transition-colors ${p.checked ? 'bg-primary/[0.02]' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {p.checked ? (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckSquare className="w-3.5 h-3.5 text-background" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-border group-hover:border-primary/50 transition-colors" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || '#666' }} />
                        <span className="text-xs text-muted-foreground">{p.status_text}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-500" 
                          style={{ width: `${p.progress || 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Column: Signal Config & Actions */}
      <div className="flex flex-col w-96 gap-6 overflow-hidden">
        
        {/* Signal Selection */}
        <div className="bg-card/50 border border-border/50 rounded-3xl flex-1 overflow-hidden flex flex-col shadow-sm">
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-primary/10 p-2 rounded-full">
                <CheckCircle2 className="text-primary w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Signals</h2>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={masterFile}
                  onChange={(e) => setMasterFile(e.target.value)}
                  placeholder="Master MF4 path..."
                  className="flex-1 bg-surface-3 border border-border/50 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button 
                  onClick={handleLoadSignals}
                  disabled={loadingSignals || !masterFile}
                  className="bg-surface-ink text-foreground border border-border/50 p-2 rounded-lg hover:bg-surface-3 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSignals ? 'animate-spin' : ''}`} />
                </button>
              </div>
              
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Filter signals..."
                  value={signalFilter}
                  onChange={(e) => setSignalFilter(e.target.value)}
                  className="w-full bg-surface-3 border border-border/50 rounded-lg pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-surface-2/30 border-b border-border/50 flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-6">
            <span>Name</span>
            <div className="flex gap-2">
              <button onClick={() => setAllSignals(true)} className="hover:text-primary">All</button>
              <button onClick={() => setAllSignals(false)} className="hover:text-primary">None</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredSignals.map(sig => (
              <div 
                key={sig.name}
                onClick={() => toggleSignal(sig.name)}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-3 cursor-pointer group"
              >
                <span className="text-xs text-foreground truncate flex-1 pr-2">{sig.name}</span>
                {sig.checked ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <SquareIcon className="w-4 h-4 text-border group-hover:text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-card/50 border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div 
                onClick={() => setCopyVideos(!copyVideos)}
                className={`w-10 h-5 rounded-full relative transition-colors ${copyVideos ? 'bg-primary' : 'bg-surface-3'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${copyVideos ? 'left-6' : 'left-1'}`} />
              </div>
              <span className="text-xs font-medium text-foreground">Copy Tracking Videos</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer group">
              <div 
                onClick={() => setOverwriteMode(!overwriteMode)}
                className={`w-10 h-5 rounded-full relative transition-colors ${overwriteMode ? 'bg-primary' : 'bg-surface-3'}`}
              >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${overwriteMode ? 'left-6' : 'left-1'}`} />
              </div>
              <span className="text-xs font-medium text-foreground">Overwrite Existing</span>
            </label>
          </div>
 
          <div className="pt-2">
            <button 
              onClick={handleRun}
              disabled={fusionState === 'running' || participants.filter(p => p.checked).length === 0}
              className="w-full bg-primary text-background rounded-lg py-4 font-bold flex items-center justify-center gap-3 shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
            >
              <Play className="w-5 h-5 fill-current" />
              START FUSION
            </button>
          </div>
        </div>
      </div>

      {/* Log Panel (absolute bottom overlay) */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-1/2 z-40 group">
        <div className="bg-[#1A1917]/95 backdrop-blur-md border border-border/50 rounded-xl shadow-2xl overflow-hidden transition-all duration-300 max-h-12 group-hover:max-h-64">
          <div className="p-3 flex justify-between items-center border-b border-border/50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-widest">Process Logs</span>
            </div>
            <div className="flex gap-4">
              <span className="text-[10px] text-muted-foreground font-mono">
                {fusionState === 'running' ? 'Processing...' : 'Idle'}
              </span>
              <button onClick={clearLogs} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="p-4 h-48 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-muted-foreground shrink-0">{new Date(log.ts).toLocaleTimeString()}</span>
                <span className="text-foreground/80">{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="text-muted-foreground italic">No logs yet.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
