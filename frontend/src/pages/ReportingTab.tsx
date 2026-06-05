import { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useReportingWS } from '../hooks/useReportingWS'
import { 
  PlayCircle, Square, RefreshCw, FolderOpen, FileSpreadsheet, Settings
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import DotField from '../components/analysis/DotField'

export default function ReportingTab() {
  const {
    reportingOutputFolder, setReportingOutputFolder,
    reportingFilename, setReportingFilename,
    reportingTemplate, setReportingTemplate,
    reportingTemplates, setReportingTemplates,
    reportingOptions, setReportingOption,
    reportingProcessing, setReportingProcessing,
    setReportingStatus,
    addLog,
    analysisSourcePath
  } = useAppStore()

  useReportingWS()

  const [loadingTemplates, setLoadingTemplates] = useState(false)

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
    if (!analysisSourcePath || !reportingOutputFolder || !reportingTemplate) {
      addLog('[Reporting] Please fill in all required fields.'); return
    }

    const showOptions = reportingTemplate?.toLowerCase().includes("driver_engagement") || reportingTemplate?.toLowerCase().includes("driver engagement");
    const selectedFolders = Object.entries(reportingOptions)
      .filter(([, checked]) => checked)
      .map(([label]) => label)

    if (showOptions && selectedFolders.length === 0) { 
      addLog('[Reporting] Select at least one processing option.'); return 
    }

    setReportingProcessing(true)
    setReportingStatus('Starting...')
    addLog(`[Reporting] Generating report: ${reportingFilename}${showOptions ? ` with ${selectedFolders.join(', ')}` : ''}`)

    try {
      const res = await fetch('/api/reporting/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_name: reportingTemplate,
          root_folder: analysisSourcePath,
          output_folder: reportingOutputFolder,
          output_filename: reportingFilename,
          selected_folders: selectedFolders,
        }),
      })
      const data = await res.json()
      if (data.status === 'already_running') { setReportingProcessing(false); addLog('[Reporting] Already running.') }
      else if (data.status === 'error') { setReportingProcessing(false); addLog(`[Reporting] Error: ${data.message}`) }
    } catch (err) { setReportingProcessing(false); addLog(`[Reporting] Error: ${err}`) }
  }

  const handleStop = async () => {
    await fetch('/api/reporting/stop', { method: 'POST' })
    addLog('[Reporting] Stop requested.')
  }

  const showOptions = reportingTemplate?.toLowerCase().includes("driver_engagement") || reportingTemplate?.toLowerCase().includes("driver engagement");

  return (
    <div className="relative flex flex-col items-center justify-center h-full min-h-0 overflow-y-auto p-8 bg-background">
      
      {/* Background Dots Layer */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <DotField
            dotRadius={1.5}
            dotSpacing={14}
            bulgeStrength={67}
            glowRadius={160}
            sparkle={false}
            waveAmplitude={0}
            cursorRadius={500}
            cursorForce={0.1}
            bulgeOnly
            darkGradientFrom="rgba(255, 255, 255, 0.75)"
            darkGradientTo="rgba(255, 255, 255, 0.45)"
            lightGradientFrom="rgba(80, 80, 80, 0.6)"
            lightGradientTo="rgba(100, 100, 100, 0.4)"
            glowColor="transparent"
          />
        </div>
      </div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Glassmorphic blur frame container */}
        <div className="flex flex-col gap-5 rounded-2xl bg-surface-2/20 border border-white/5 p-6 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300">
          
          <div className="flex flex-col gap-2">
            <Label htmlFor="template" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> Template
            </Label>
            <div className="flex gap-2">
              <select 
                id="template"
                value={reportingTemplate} 
                onChange={(e) => { 
                  setReportingTemplate(e.target.value); 
                  const tpl = reportingTemplates.find((t: any) => t.name === e.target.value); 
                  if (tpl?.options) {
                    tpl.options.forEach((o: any) => setReportingOption(o.label || o, o.default !== false));
                  }
                }} 
                className="flex-1 bg-surface-3/50 border border-border/50 rounded-lg px-4 py-2 text-xs focus:outline-none appearance-none cursor-pointer text-foreground"
              >
                {reportingTemplates.length === 0 && !loadingTemplates && <option value="">Loading...</option>}
                {reportingTemplates.map((t: any) => <option key={t.name || t} value={t.name || t} className="bg-background">{t.name || t}</option>)}
              </select>
              <button 
                onClick={() => {
                  fetch('/api/reporting/templates').then(r => r.json()).then(d => setReportingTemplates((d.templates || []).map((t: any) => typeof t === 'string' ? { name: t, path: t, options: [] } : t)))
                }} 
                className="p-2 bg-surface-3/50 rounded-lg border border-border/50 hover:bg-surface-3 transition-colors text-foreground"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTemplates ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>



          <div className="flex flex-col gap-2">
            <Label htmlFor="outputFolder" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> Output Folder
            </Label>
            <Input
              id="outputFolder"
              value={reportingOutputFolder}
              onChange={(e) => setReportingOutputFolder(e.target.value)}
              placeholder="Destination folder..."
              className="h-9 focus-visible:ring-orange-500"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="outputFilename" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" /> Output Filename
            </Label>
            <Input
              id="outputFilename"
              value={reportingFilename}
              onChange={(e) => setReportingFilename(e.target.value)}
              placeholder="Report_Results.xlsx"
              className="h-9 focus-visible:ring-orange-500"
            />
          </div>

          {showOptions && Object.keys(reportingOptions).length > 0 && (
            <div className="flex flex-col gap-3 pt-3 border-t border-white/5">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-muted-foreground" /> Processing Options
              </Label>
              <div className="space-y-2 pl-1">
                {Object.entries(reportingOptions).map(([label, checked]) => (
                  <div key={label} className="flex items-center justify-between py-1 group/option">
                    <Label htmlFor={`opt-${label}`} className="text-xs text-muted-foreground group-hover/option:text-foreground transition-colors cursor-pointer select-none">
                      {label}
                    </Label>
                    <Switch
                      id={`opt-${label}`}
                      checked={checked}
                      onCheckedChange={(val) => setReportingOption(label, val)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action button container */}
          <div className="pt-4 border-t border-white/5">
            {!reportingProcessing ? (
              <Button 
                onClick={handleGenerate} 
                disabled={!reportingTemplate} 
                className="w-full h-11 bg-primary text-background font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                GENERATE REPORT
              </Button>
            ) : (
              <Button 
                onClick={handleStop} 
                variant="destructive"
                className="w-full h-11 font-bold flex items-center justify-center gap-2"
              >
                <Square className="w-4 h-4" /> STOP
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}