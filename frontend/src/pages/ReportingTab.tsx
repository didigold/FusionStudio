import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useReportingWS } from '../hooks/useReportingWS'
import { 
  FileText, Settings2, PlayCircle, Square,
  Download, Search, Eye, FileSpreadsheet, RefreshCw, Loader2
} from 'lucide-react'

export default function ReportingTab() {
  const {
    reportingRootFolder, setReportingRootFolder,
    reportingOutputFolder, setReportingOutputFolder,
    reportingFilename, setReportingFilename,
    reportingTemplate, setReportingTemplate,
    reportingTemplates, setReportingTemplates,
    reportingOptions, setReportingOption,
    reportingProcessing, setReportingProcessing,
    reportingStatus, setReportingStatus,
    reportingOutputPath,
    reportingPreviewData, setReportingPreviewData,
    addLog
  } = useAppStore()

  useReportingWS()

  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [previewSheet, setPreviewSheet] = useState('DISTRACTION')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    setLoadingTemplates(true)
    fetch('/api/reporting/templates')
      .then(r => r.json())
      .then(data => {
        const tpls = data.templates || []
        setReportingTemplates(Array.isArray(tpls) ? tpls.map((t: any) => typeof t === 'string' ? { name: t, path: t, options: [] } : t) : [])
        if (tpls.length > 0 && !reportingTemplate) {
          setReportingTemplate(tpls[0].name || tpls[0])
          const opts = tpls[0]?.options || []
          if (opts.length > 0) opts.forEach((o: any) => setReportingOption(o.label || o, true))
          else setReportingOption('Distractions', true)
        }
      })
      .finally(() => setLoadingTemplates(false))
  }, [])

  const handleGenerate = async () => {
    if (!reportingRootFolder || !reportingOutputFolder || !reportingTemplate) {
      addLog('Please fill in all required fields.'); return
    }

    const selectedFolders = Object.entries(reportingOptions)
      .filter(([, checked]) => checked)
      .map(([label]) => label)

    if (selectedFolders.length === 0) { addLog('Select at least one processing option.'); return }

    setReportingProcessing(true)
    setReportingStatus('Starting...')
    addLog(`Generating report: ${reportingFilename} with ${selectedFolders.join(', ')}`)

    try {
      const res = await fetch('/api/reporting/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: reportingTemplate,
          root_folder: reportingRootFolder,
          output_folder: reportingOutputFolder,
          output_filename: reportingFilename,
          selected_folders: selectedFolders,
        }),
      })
      const data = await res.json()
      if (data.status === 'already_running') { setReportingProcessing(false); addLog('Already running.') }
      else if (data.status === 'error') { setReportingProcessing(false); addLog(`Error: ${data.message}`) }
    } catch (err) { setReportingProcessing(false); addLog(`Error: ${err}`) }
  }

  const handleStop = async () => {
    await fetch('/api/reporting/stop', { method: 'POST' })
    addLog('Stop requested.')
  }

  const handlePreview = async () => {
    if (!reportingOutputPath) { addLog('Generate a report first.'); return }
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/reporting/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: reportingOutputPath, sheet_name: previewSheet }),
      })
      const data = await res.json()
      setReportingPreviewData(data)
    } catch (err) { addLog(`Preview error: ${err}`) }
    finally { setPreviewLoading(false) }
  }

  return (
    <div className="flex h-full gap-6 p-1 overflow-hidden">
      <div className="w-80 flex flex-col gap-6 overflow-hidden">
        <div className="bg-card/50 border border-border/50 rounded-3xl p-5 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-3"><Settings2 className="text-primary w-5 h-5" /><h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Report Config</h2></div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Template</label>
              <div className="flex gap-2">
                <select value={reportingTemplate} onChange={(e) => { setReportingTemplate(e.target.value); const tpl = reportingTemplates.find((t: any) => t.name === e.target.value); if (tpl?.options) tpl.options.forEach((o: any) => setReportingOption(o.label || o, o.default !== false)) }} className="flex-1 bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-[11px] focus:outline-none appearance-none">
                  {reportingTemplates.length === 0 && !loadingTemplates && <option value="">Loading...</option>}
                  {reportingTemplates.map((t: any) => <option key={t.name || t} value={t.name || t}>{t.name || t}</option>)}
                </select>
                <button onClick={() => {
                  fetch('/api/reporting/templates').then(r => r.json()).then(d => setReportingTemplates((d.templates || []).map((t: any) => typeof t === 'string' ? { name: t, path: t, options: [] } : t)))
                }} className="p-2 bg-surface-ink rounded-lg border border-border/50">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTemplates ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Root Folder</label>
              <input type="text" value={reportingRootFolder} onChange={(e) => setReportingRootFolder(e.target.value)} placeholder="Root with P01, P02..." className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-[11px] focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Output Folder</label>
              <input type="text" value={reportingOutputFolder} onChange={(e) => setReportingOutputFolder(e.target.value)} placeholder="Destination folder..." className="w-full bg-surface-3 border border-border/50 rounded-lg px-3 py-2 text-[11px] focus:outline-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Output Filename</label>
              <input type="text" value={reportingFilename} onChange={(e) => setReportingFilename(e.target.value)} className="w-full bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-[11px] focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="bg-card/50 border border-border/50 rounded-3xl flex-1 overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 border-b border-border/50 bg-surface-2/30 flex items-center justify-between">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-widest">Processing Options</span>
          </div>
          <div className="p-4 space-y-4">
            {Object.entries(reportingOptions).map(([label, checked]) => (
              <label key={label} className="flex items-center justify-between cursor-pointer group">
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                <div onClick={() => setReportingOption(label, !checked)} className={`w-8 h-4 rounded-full relative transition-colors ${checked ? 'bg-primary' : 'bg-surface-3'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
                </div>
              </label>
            ))}
            {Object.keys(reportingOptions).length === 0 && <p className="text-[11px] text-muted-foreground italic">No options.</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-card/50 border border-border/50 rounded-3xl flex flex-col overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/50 bg-surface-2/30 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-2 rounded-full"><FileText className="text-primary w-5 h-5" /></div>
            <div><h2 className="text-lg font-bold text-foreground">Report Generator</h2><p className="text-xs text-muted-foreground">Export into Excel templates with automated calculations.</p></div>
          </div>
          <div className="flex items-center gap-3">
            {!reportingProcessing ? (
              <button onClick={handleGenerate} disabled={!reportingTemplate} className="bg-primary text-background px-8 py-3 rounded-lg font-bold flex items-center gap-3 hover:bg-primary/90 transition-all shadow-lg disabled:opacity-50">
                <PlayCircle className="w-5 h-5" /> GENERATE REPORT
              </button>
            ) : (
              <button onClick={handleStop} className="bg-destructive text-destructive-foreground px-6 py-3 rounded-lg font-bold flex items-center gap-3 hover:bg-destructive/90 transition-all">
                <Square className="w-4 h-4" /> STOP
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {reportingPreviewData ? (
            <div className="h-full flex flex-col">
              <div className="p-3 bg-surface-2/50 border-b border-border/30 flex items-center gap-3 px-6">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Preview: </span>
                <span className="text-xs font-bold text-primary">{reportingPreviewData.sheet || previewSheet}</span>
                <span className="text-[10px] text-muted-foreground ml-2">{reportingPreviewData.row_count} rows</span>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar p-4">
                {reportingPreviewData.error ? (
                  <div className="text-red-500 text-center p-8">{reportingPreviewData.error}</div>
                ) : (
                  <table className="w-full text-left border-collapse border border-border/30 text-[11px]">
                    <thead className="sticky top-0 bg-surface-2 z-10">
                      <tr>
                        {reportingPreviewData.columns?.map((col: string, i: number) => (
                          <th key={i} className="px-3 py-2 border border-border/30 text-[10px] font-bold text-muted-foreground uppercase">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {reportingPreviewData.rows?.map((row: any[], i: number) => (
                        <tr key={i} className="hover:bg-primary/5 transition-colors">
                          {row.map((val, j) => <td key={j} className="px-3 py-1.5 border border-border/20 text-xs text-foreground">{String(val ?? '')}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-6">
              <div className="relative"><FileSpreadsheet className="w-24 h-24 opacity-10" /><Search className="absolute -bottom-2 -right-2 w-10 h-10 text-primary opacity-20" /></div>
              <div className="text-center space-y-2"><p className="text-lg font-bold">Template Preview</p><p className="max-w-md text-sm opacity-50">Generate a report or enter a path above to preview results.</p></div>
              <div className="flex items-center gap-2 mt-4">
                <input type="text" value={previewSheet} onChange={(e) => setPreviewSheet(e.target.value)} placeholder="Sheet name" className="bg-surface-3 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none w-40" />
                <button onClick={handlePreview} disabled={previewLoading || !reportingOutputPath} className="bg-surface-ink border border-border/50 text-foreground px-4 py-2 rounded-lg text-xs font-bold hover:bg-surface-3 disabled:opacity-50 flex items-center gap-1.5">
                  {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} Preview
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-surface-ink border-t border-border/50 flex justify-between items-center px-6">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${reportingProcessing ? 'bg-primary animate-pulse' : 'bg-green-500'}`} />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">{reportingStatus}</span>
          </div>
          {reportingOutputPath && (
            <button className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> OPEN FOLDER</button>
          )}
        </div>
      </div>
    </div>
  )
}