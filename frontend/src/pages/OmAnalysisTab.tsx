import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { 
  Video, Activity, Clock, CheckCircle2,
  Play, Maximize2, FileSearch, BarChart3, Loader2
} from 'lucide-react'

export default function OmAnalysisTab() {
  const { addLog } = useAppStore()

  const [sourcePath, setSourcePath] = useState('')
  const [scanning, setScanning] = useState(false)
  const [files, setFiles] = useState<any[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [channels, setChannels] = useState<any[]>([])
  const [selectedChannel, setSelectedChannel] = useState('')
  const [metrics, setMetrics] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)

  const handleScan = async () => {
    if (!sourcePath) return
    setScanning(true)
    try {
      const res = await fetch('/api/analysis/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: sourcePath }),
      })
      const data = await res.json()
      const allFiles: any[] = []
      const collect = (items: any[]) => { for (const item of items) { if (item.type === 'file') allFiles.push(item); if (item.children) collect(item.children) } }
      collect(data.results || [])
      setFiles(allFiles)
      addLog(`OM scan found ${allFiles.length} files.`)
    } catch (err) { addLog(`OM scan error: ${err}`) }
    finally { setScanning(false) }
  }

  const selectFile = async (fpath: string) => {
    setSelectedFile(fpath)
    setSelectedChannel('')
    setMetrics(null)
    try {
      const res = await fetch('/api/analysis/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: fpath }),
      })
      const data = await res.json()
      setChannels(data.channels || [])
    } catch (err) { addLog(`Channels error: ${err}`) }
  }

  const analyzeSignal = async (chName: string) => {
    setSelectedChannel(chName)
    setAnalyzing(true)
    try {
      const res = await fetch('/api/analysis/detect/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: selectedFile, channel_name: chName }),
      })
      const data = await res.json()
      if (!data.error) {
        setMetrics({
          channel: chName,
          rms: data.rms,
          mean: data.mean,
          std: data.std,
          min: data.min,
          max: data.max,
          first_event: data.first_event_time,
        })
        addLog(`Analyzed ${chName}: RMS=${data.rms?.toFixed(3)}, first event at ${data.first_event_time != null ? data.first_event_time.toFixed(2) + 's' : 'none'}`)
      } else {
        setMetrics({ error: data.error, channel: chName })
        addLog(`Analysis error: ${data.error}`)
      }
    } catch (err) { addLog(`Signal analysis error: ${err}`) }
    finally { setAnalyzing(false) }
  }

  return (
    <div className="flex h-full gap-6 p-1 overflow-hidden">
      <div className="w-80 flex flex-col gap-6 overflow-hidden">
        <div className="bg-card/50 border border-border/50 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <FileSearch className="text-primary w-5 h-5" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">OM Source</h2>
          </div>
          <input type="text" value={sourcePath} onChange={(e) => setSourcePath(e.target.value)} placeholder="Path to analysis results..." className="bg-surface-3 border border-border/50 rounded-md px-3 py-2 text-xs focus:outline-none" />
          <button onClick={handleScan} disabled={scanning || !sourcePath} className="bg-primary text-background rounded-full py-2 font-bold text-xs hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {scanning ? 'Scanning...' : 'Scan Directory'}
          </button>
        </div>

        <div className="bg-card/50 border border-border/50 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border/50 bg-surface-2/30 flex items-center gap-2">
            <Video className="text-primary w-4 h-4" />
            <span className="text-xs font-bold text-foreground uppercase">Files ({files.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {files.map((f, i) => (
              <div key={i} onClick={() => selectFile(f.path)} className={`p-3 rounded-lg mb-1 cursor-pointer transition-all ${selectedFile === f.path ? 'bg-primary text-background' : 'hover:bg-surface-3'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold truncate">{f.name}</span>
                  {f.has_tracking && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                </div>
              </div>
            ))}
            {files.length === 0 && <p className="text-muted-foreground text-center text-xs p-4">Scan a directory to find files.</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="grid grid-cols-3 gap-6 h-2/3">
          <div className="col-span-2 bg-black border border-border/50 rounded-2xl overflow-hidden relative group flex items-center justify-center">
            <Video className="w-16 h-16 text-white/5" />
            <div className="absolute bottom-4 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-4 bg-background/80 backdrop-blur-md px-6 py-3 rounded-full border border-border/30">
              <button className="text-foreground hover:text-primary"><Play className="w-5 h-5 fill-current" /></button>
              <div className="w-48 h-1 bg-surface-3 rounded-full"><div className="h-full bg-primary rounded-full w-1/3" /></div>
              <button className="text-foreground hover:text-primary"><Maximize2 className="w-4 h-4" /></button>
            </div>
            <div className="absolute top-4 left-4 bg-primary/20 backdrop-blur-md px-3 py-1 rounded-full border border-primary/30">
              <span className="text-[10px] font-bold text-primary uppercase">Tracking Preview</span>
            </div>
          </div>

          <div className="bg-card/50 border border-border/50 rounded-2xl p-6 flex flex-col gap-4 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2"><BarChart3 className="text-primary w-4 h-4" /><span className="text-xs font-bold text-foreground uppercase">OM Metrics</span></div>

            {metrics && !metrics.error ? (
              <div className="space-y-3 flex-1 overflow-auto">
                {[
                  ['RMS', metrics.rms?.toFixed(4), ''],
                  ['Mean', metrics.mean?.toFixed(4), ''],
                  ['Std Dev', metrics.std?.toFixed(4), ''],
                  ['Min', metrics.min?.toFixed(4), ''],
                  ['Max', metrics.max?.toFixed(4), ''],
                  ['First Event', metrics.first_event != null ? metrics.first_event.toFixed(3) + 's' : 'None', ''],
                ].map(([label, value]) => (
                  <div key={label} className="bg-surface-2/40 rounded-lg p-3">
                    <span className="text-[9px] text-muted-foreground uppercase block">{label}</span>
                    <span className="text-sm font-bold text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            ) : metrics?.error ? (
              <div className="text-red-500 text-xs">{metrics.error}</div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs opacity-50">
                Select a channel and run analysis.
              </div>
            )}

            {channels.length > 0 && (
              <div className="border-t border-border/30 pt-3">
                <select value={selectedChannel} onChange={(e) => { setSelectedChannel(e.target.value); analyzeSignal(e.target.value) }} className="w-full bg-surface-3 border border-border/50 rounded-full px-4 py-2 text-[11px] focus:outline-none appearance-none">
                  <option value="">Select channel...</option>
                  {channels.map((ch: any, i: number) => <option key={i} value={ch.name}>{ch.name}</option>)}
                </select>
              </div>
            )}

            {analyzing && <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto" />}
          </div>
        </div>

        <div className="flex-1 bg-card/50 border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="text-primary w-4 h-4" />
              <h2 className="text-sm font-bold text-foreground uppercase">Signal Correlation</h2>
            </div>
          </div>
          <div className="flex-1 bg-surface-ink border border-border/30 rounded-xl relative overflow-hidden flex items-center justify-center">
            {selectedFile ? (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">File: {selectedFile.split('\\').pop()}</p>
                <p className="text-[10px] text-muted-foreground/50">{channels.length} channels available</p>
                {selectedChannel && <p className="text-[10px] text-primary mt-1">Analyzing: {selectedChannel}</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center opacity-10">
                <Clock className="w-12 h-12 mb-2" />
                <p className="text-xs">Select a file to view correlation data.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}