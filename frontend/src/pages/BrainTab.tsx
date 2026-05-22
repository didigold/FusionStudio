import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useBrainTrainingWS } from '../hooks/useBrainTrainingWS'
import { 
  Cpu, Settings, Play, Square, History,
  Database, Layers, TrendingDown, RefreshCw, Zap
} from 'lucide-react'

export default function BrainTab() {
  const {
    brainProjectsRoot, setBrainProjectsRoot,
    brainProjects, setBrainProjects,
    brainModels, setBrainModels,
    brainHistory, setBrainHistory,
    brainArchitecture, setBrainArchitecture,
    brainModelName, setBrainModelName,
    brainEpochs, setBrainEpochs,
    brainLR, setBrainLR,
    brainPatience, setBrainPatience,
    brainTraining, setBrainTraining,
    brainPhase, brainPhaseProgress,
    brainEpochData, clearBrainEpochData,
    addLog
  } = useAppStore()

  useBrainTrainingWS()

  const [scanning, setScanning] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/brain/models').then(r => r.json()).then(d => setBrainModels(d.models || []))
    fetch('/api/brain/history').then(r => r.json()).then(d => setBrainHistory(d))
  }, [])

  const handleScan = async () => {
    if (!brainProjectsRoot) return
    setScanning(true)
    try {
      const res = await fetch(`/api/brain/projects?root=${encodeURIComponent(brainProjectsRoot)}`)
      const data = await res.json()
      setBrainProjects(data.projects || [])
      addLog(`Found ${data.projects?.length || 0} projects.`)
    } catch (err) { addLog(`Scan error: ${err}`) }
    finally { setScanning(false) }
  }

  const toggleProject = (path: string) => {
    setSelectedProjects(p => p.includes(path) ? p.filter(x => x !== path) : [...p, path])
  }

  const selectAll = () => {
    setSelectedProjects(selectedProjects.length === brainProjects.length ? [] : brainProjects.map((p: any) => p.path))
  }

  const handleStartTraining = async () => {
    if (selectedProjects.length === 0) { addLog('Select at least one project.'); return }
    setBrainTraining(true)
    clearBrainEpochData()
    addLog(`Starting ${brainArchitecture} training: ${brainModelName} on ${selectedProjects.length} project(s)`)

    try {
      const endpoint = brainArchitecture === 'legacy' ? '/api/brain/train/legacy' : '/api/brain/train/multimodal'
      const body: any = {
        root_folders: selectedProjects,
        model_name: brainModelName,
        epochs: brainEpochs,
        lr: brainLR,
      }
      if (brainArchitecture === 'multimodal') body.patience = brainPatience

      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (err) { setBrainTraining(false); addLog(`Error: ${err}`) }
  }

  const handleStop = async () => {
    await fetch('/api/brain/stop', { method: 'POST' })
    addLog('Stop requested.')
  }

  return (
    <div className="flex h-full gap-6 p-1 overflow-hidden">
      <div className="w-96 flex flex-col gap-6 overflow-hidden">
        <div className="bg-card/50 border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full"><Settings className="text-primary w-4 h-4" /></div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Training Params</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-2"><Layers className="w-3 h-3" /> Architecture</label>
              <div className="flex bg-surface-3 rounded-lg p-1 border border-border/30">
                <button onClick={() => setBrainArchitecture('multimodal')} className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${brainArchitecture === 'multimodal' ? 'bg-primary text-background shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>MULTIMODAL</button>
                <button onClick={() => setBrainArchitecture('legacy')} className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${brainArchitecture === 'legacy' ? 'bg-primary text-background shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>LEGACY</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-muted-foreground uppercase">Model Name</label><input type="text" value={brainModelName} onChange={(e) => setBrainModelName(e.target.value)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-muted-foreground uppercase">Epochs</label><input type="number" value={brainEpochs} onChange={(e) => setBrainEpochs(parseInt(e.target.value) || 100)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-muted-foreground uppercase">LR</label><input type="text" value={brainLR} onChange={(e) => setBrainLR(parseFloat(e.target.value) || 0.001)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none" /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-bold text-muted-foreground uppercase">Patience</label><input type="number" value={brainPatience} onChange={(e) => setBrainPatience(parseInt(e.target.value) || 15)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none" /></div>
            </div>
          </div>
        </div>

        <div className="bg-card/50 border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3"><Database className="text-primary w-4 h-4" /><h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Projects</h2></div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input type="text" value={brainProjectsRoot} onChange={(e) => setBrainProjectsRoot(e.target.value)} placeholder="Projects directory..." className="flex-1 bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-[10px] focus:outline-none" />
              <button onClick={handleScan} className="bg-surface-ink border border-border/50 p-2 rounded-lg hover:bg-surface-3"><RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} /></button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-[10px] text-primary hover:underline">{selectedProjects.length === brainProjects.length ? 'Deselect All' : 'Select All'}</button>
              <span className="text-[10px] text-muted-foreground">{selectedProjects.length}/{brainProjects.length}</span>
            </div>
            <div className="max-h-36 overflow-y-auto custom-scrollbar border border-border/30 rounded-lg p-1 bg-surface-2/30">
              {brainProjects.map((p: any, i: number) => (
                <label key={i} onClick={() => toggleProject(p.path)} className="flex items-center gap-2 p-2 hover:bg-primary/10 rounded cursor-pointer text-[10px] text-foreground">
                  <input type="checkbox" checked={selectedProjects.includes(p.path)} onChange={() => toggleProject(p.path)} className="w-3 h-3 accent-primary rounded" />
                  {p.name} <span className="text-muted-foreground ml-auto">{p.avis}A {p.mf4s}M</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Models */}
        {brainModels.length > 0 && (
          <div className="bg-card/50 border border-border/50 rounded-3xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2"><History className="text-primary w-3 h-3" /><span className="text-[10px] font-bold text-muted-foreground uppercase">Saved Models</span></div>
            <div className="space-y-0.5 max-h-24 overflow-y-auto text-[10px] font-mono text-muted-foreground">
              {brainModels.map((m: any, i: number) => (
                <div key={i}>{m.architecture}/{m.variant} — {m.size_mb}MB</div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto pt-2">
          {!brainTraining ? (
            <button onClick={handleStartTraining} disabled={selectedProjects.length === 0} className="w-full bg-primary text-background rounded-lg py-5 font-bold flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50">
              <Play className="w-5 h-5 fill-current" /> START TRAINING
            </button>
          ) : (
            <div className="space-y-3">
              <button onClick={handleStop} className="w-full bg-destructive text-white rounded-lg py-5 font-bold flex items-center justify-center gap-3 hover:bg-destructive/90 transition-all">
                <Square className="w-5 h-5 fill-current" /> STOP TRAINING
              </button>
              <span className="text-xs text-primary font-semibold animate-pulse block text-center uppercase">{brainPhase || 'Running...'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Training Monitor */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="bg-card/50 border border-border/50 rounded-3xl p-8 flex-1 flex flex-col overflow-hidden shadow-sm relative">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Training Monitor</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase font-bold">Phase:</span>
                <span className="text-xs text-primary font-bold">{brainPhase || 'Idle'}</span>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Accuracy</span>
                <span className="text-xl font-bold text-foreground">{brainEpochData.length > 0 ? (brainEpochData[brainEpochData.length - 1].acc * 100).toFixed(1) + '%' : '--'}</span>
              </div>
              <div className="text-right border-l border-border/30 pl-4">
                <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Loss</span>
                <span className="text-xl font-bold text-foreground">{brainEpochData.length > 0 ? brainEpochData[brainEpochData.length - 1].loss?.toFixed(4) : '--'}</span>
              </div>
            </div>
          </div>

          {/* Live epoch data table */}
          <div className="flex-1 overflow-auto">
            {brainEpochData.length > 0 ? (
              <table className="w-full text-[11px] font-mono">
                <thead className="sticky top-0 bg-surface-2/80 backdrop-blur z-10">
                  <tr className="text-[10px] text-muted-foreground uppercase">
                    <th className="text-left py-2 pr-4">Epoch</th>
                    <th className="text-right py-2 pr-4">Loss</th>
                    <th className="text-right py-2 pr-4">Acc</th>
                    <th className="text-right py-2 pr-4">Val Loss</th>
                    <th className="text-right py-2">Val Acc</th>
                  </tr>
                </thead>
                <tbody>
                  {brainEpochData.slice(-40).map((d: any, i: number) => (
                    <tr key={i} className="border-b border-border/10 hover:bg-primary/5">
                      <td className="py-1 pr-4 text-primary font-bold">{d.epoch}</td>
                      <td className="py-1 pr-4 text-right text-muted-foreground">{d.loss?.toFixed(4)}</td>
                      <td className="py-1 pr-4 text-right text-foreground">{d.acc != null ? (d.acc * 100).toFixed(1) + '%' : '-'}</td>
                      <td className="py-1 pr-4 text-right text-muted-foreground">{d.val_loss?.toFixed(4) || '-'}</td>
                      <td className="py-1 text-right text-foreground">{d.val_acc != null ? (d.val_acc * 100).toFixed(1) + '%' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <TrendingDown className="w-20 h-20 mb-4" /><p className="text-xl font-bold">Loss Curve Display</p>
              </div>
            )}
          </div>

          {brainTraining && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/20">
              <div className="h-full bg-primary animate-pulse" style={{ width: `${Math.min(brainPhaseProgress * 100, 100)}%` }} />
            </div>
          )}

          {/* History summary */}
          {brainHistory && (brainHistory.mlp || brainHistory.multimodal) && (
            <div className="mt-4 pt-4 border-t border-border/30 flex gap-6">
              {brainHistory.mlp && (
                <div className="flex items-center gap-2 text-[10px]">
                  <Cpu className="w-3 h-3 text-primary/50" />
                  <span className="text-muted-foreground">MLP: <span className="text-foreground font-bold">{brainHistory.mlp.name}</span> ({brainHistory.mlp.projects?.length || 0} projects)</span>
                </div>
              )}
              {brainHistory.multimodal && (
                <div className="flex items-center gap-2 text-[10px]">
                  <Zap className="w-3 h-3 text-primary/50" />
                  <span className="text-muted-foreground">Multi: <span className="text-foreground font-bold">{brainHistory.multimodal.epochs} epochs</span>, best acc: <span className="text-foreground font-bold">{brainHistory.multimodal.best_acc != null ? (brainHistory.multimodal.best_acc * 100).toFixed(1) + '%' : '-'}</span></span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}