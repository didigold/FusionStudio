import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useClassifyWS } from '../hooks/useClassifyWS'
import { 
  Tags, FolderSearch, Settings, PlayCircle, Square,
  CheckCircle2, AlertCircle, FileText, Calendar, Building, Hash, Activity, Hourglass
} from 'lucide-react'

export default function ClassificationTab() {
  const {
    classifySourcePath, setClassifySourcePath,
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
    classifyStatus, setClassifyStatus,
    addLog
  } = useAppStore()

  useClassifyWS()

  const [previewNames, setPreviewNames] = useState<Record<string, string>>({})

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

  const handleScan = async () => {
    if (!classifySourcePath) return
    setClassifyStatus('Scanning...')
    try {
      const res = await fetch('/api/classification/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: classifySourcePath }),
      })
      const data = await res.json()
      setClassifyGroups(data.groups || [])
      addLog(`Classification scan found ${data.groups?.length || 0} groups.`)
      setClassifyStatus('Scan complete.')
    } catch (err) {
      addLog(`Error scanning classify dir: ${err}`)
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
    await fetch('/api/classification/stop', { method: 'POST' })
    addLog('Stop requested.')
  }

  return (
    <div className="flex h-full gap-6 p-1 overflow-hidden">
      <div className="w-96 flex flex-col gap-6 overflow-hidden">
        <div className="bg-card/50 border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Settings className="text-primary w-5 h-5" />
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Protocol Config</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Year</label>
              <input type="text" maxLength={2} value={classifyYear} onChange={(e) => setClassifyYear(e.target.value.toUpperCase())} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none uppercase" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Building className="w-3 h-3" /> OEM</label>
              <input type="text" maxLength={3} value={classifyOem} onChange={(e) => setClassifyOem(e.target.value.toUpperCase())} placeholder="Ex: BMW" className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none uppercase" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Hash className="w-3 h-3" /> Reference</label>
            <input type="text" maxLength={4} value={classifyRef} onChange={(e) => setClassifyRef(e.target.value)} placeholder="Ex: 1001" className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><Activity className="w-3 h-3" /> Protocol</label>
            <select value={classifyProtocol} onChange={(e) => setClassifyProtocol(e.target.value)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none appearance-none">
              <option value="DSM">EuroNCAP DSM</option>
              <option value="ADDW">EuroNCAP ADDW</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5"><FileText className="w-3 h-3" /> Report PDF</label>
            <input type="text" value={classifyReportPdf} onChange={(e) => setClassifyReportPdf(e.target.value)} placeholder="Path to report PDF..." className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none" />
          </div>
        </div>

        <div className="bg-card/50 border border-border/50 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-3"><FolderSearch className="text-primary w-5 h-5" /><h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Paths</h2></div>
          <div className="space-y-3">
            <div className="space-y-1"><span className="text-[10px] text-muted-foreground font-bold">SOURCE</span><input type="text" value={classifySourcePath} onChange={(e) => setClassifySourcePath(e.target.value)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-[10px] focus:outline-none" /></div>
            <div className="space-y-1"><span className="text-[10px] text-muted-foreground font-bold">OUTPUT</span><input type="text" value={classifyOutputPath} onChange={(e) => setClassifyOutputPath(e.target.value)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-[10px] focus:outline-none" /></div>
            <button onClick={handleScan} className="w-full bg-surface-ink border border-border/50 text-foreground rounded-lg py-2.5 font-bold text-xs hover:bg-surface-3 transition-all mt-2">REFRESH DIRECTORY</button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-card/50 border border-border/50 rounded-3xl flex flex-col overflow-hidden shadow-sm relative">
        <div className="p-6 border-b border-border/50 bg-surface-2/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-full"><Tags className="text-primary w-5 h-5" /></div>
            <div><h2 className="text-lg font-bold text-foreground">File Classification</h2><p className="text-xs text-muted-foreground">Map raw MF4 files to NCAP official naming conventions.</p></div>
          </div>
          {!classifyProcessing ? (
            <button onClick={handleProcessAll} disabled={classifyGroups.length === 0} className="bg-primary text-background px-8 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 disabled:opacity-50">
              <PlayCircle className="w-5 h-5" /> PROCESS ALL
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={handleStop} className="bg-destructive text-destructive-foreground px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-destructive/90 transition-all">
                <Square className="w-4 h-4" /> STOP
              </button>
              <span className="text-xs text-primary font-semibold animate-pulse">{classifyStatus}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {classifyGroups.length > 0 ? classifyGroups.map((group: any, gIdx: number) => (
            <div key={gIdx} className="bg-surface-ink/30 border border-border/30 rounded-xl overflow-hidden">
              <div className="p-4 bg-surface-2/40 border-b border-border/30 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-foreground uppercase tracking-widest">{group.case_key || group.name}</span>
                  <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold">{group.files.length} FILES</span>
                  <span className="text-[10px] text-muted-foreground">{group.description}</span>
                </div>
              </div>
              <div className="divide-y divide-border/20">
                {group.files.map((file: any, fIdx: number) => (
                  <div key={fIdx} onClick={() => classifyToggleFile(gIdx, fIdx)} className="p-4 flex items-center justify-between hover:bg-primary/5 cursor-pointer group transition-colors">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${file.checked ? 'bg-primary border-primary' : 'border-border'}`}>
                        {file.checked && <CheckCircle2 className="w-3 h-3 text-background" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-mono text-muted-foreground">{file.filename.replace('_tracking', '')}</span>
                        <span className="text-xs font-bold text-primary group-hover:text-primary transition-colors">
                          {previewNames[file.path] || 'Calculating...'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold">NCAP CODE</span>
                        <span className="text-xs font-bold text-foreground">{group.nc_code || '---'}</span>
                      </div>
                      <div className="w-5 flex justify-center">
                        {file.status === 'done' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                         file.status === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                         <Hourglass className="w-4 h-4 text-primary/50" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 opacity-30">
              <Tags className="w-20 h-20" /><p className="text-lg">Scan a source folder to start classification.</p>
            </div>
          )}
        </div>

        {classifyProcessing && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-3">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${classifyProgress}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}