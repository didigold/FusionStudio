import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useReportingWS } from '../hooks/useReportingWS'
import { 
  PlayCircle, Square, RefreshCw, FolderOpen, FileSpreadsheet, Settings
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'

interface SVGPathInfo {
  viewBox: string
  paths: string[]
}

const backgroundSVGs: Record<string, SVGPathInfo> = {
  template: {
    viewBox: "0 0 100 100",
    paths: [
      "M 30 15 H 65 L 75 25 V 85 H 30 Z",
      "M 65 15 V 25 H 75",
      "M 38 38 H 68",
      "M 38 50 H 68",
      "M 38 62 H 68",
      "M 38 74 H 68",
      "M 48 32 V 78"
    ]
  },
  rootFolder: {
    viewBox: "0 0 100 100",
    paths: [
      "M 20 25 H 40 L 48 33 H 80 V 75 H 20 Z",
      "M 28 45 H 72",
      "M 28 55 H 72"
    ]
  },
  outputFolder: {
    viewBox: "0 0 100 100",
    paths: [
      "M 20 25 H 40 L 48 33 H 80 V 75 H 20 Z",
      "M 50 40 V 62",
      "M 42 54 L 50 62 L 58 54"
    ]
  },
  outputFilename: {
    viewBox: "0 0 100 100",
    paths: [
      "M 25 15 H 60 L 70 25 V 85 H 25 Z",
      "M 60 15 V 25 H 70",
      "M 40 70 L 65 45 L 70 50 L 45 75 Z",
      "M 40 70 L 42 75 L 45 75"
    ]
  },
  options: {
    viewBox: "0 0 100 100",
    paths: [
      "M 50 35 A 15 15 0 1 1 50 65 A 15 15 0 1 1 50 35 Z",
      "M 50 20 V 30",
      "M 50 70 V 80",
      "M 30 50 H 40",
      "M 60 50 H 70",
      "M 36 36 L 43 43",
      "M 57 57 L 64 64",
      "M 64 36 L 57 43",
      "M 43 57 L 36 64"
    ]
  }
}

export default function ReportingTab() {
  const {
    reportingRootFolder, setReportingRootFolder,
    reportingOutputFolder, setReportingOutputFolder,
    reportingFilename, setReportingFilename,
    reportingTemplate, setReportingTemplate,
    reportingTemplates, setReportingTemplates,
    reportingOptions, setReportingOption,
    reportingProcessing, setReportingProcessing,
    setReportingStatus,
    addLog
  } = useAppStore()

  useReportingWS()

  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [activeField, setActiveField] = useState<'template' | 'rootFolder' | 'outputFolder' | 'outputFilename' | 'options'>('template')
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setActiveFieldDebounced = useCallback((field: 'template' | 'rootFolder' | 'outputFolder' | 'outputFilename' | 'options') => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setActiveField(field), 150);
  }, []);

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
          root_folder: reportingRootFolder,
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
      
      {/* Background Grid & Animation Layer */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {/* Pulsing Grid Backdrop - centered to align coordinates mathematically */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          style={{ 
            maskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 70%, transparent 100%)', 
            WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 70%, transparent 100%)' 
          }}
        >
          {/* Base faint grid — pure CSS, dynamic border references */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
          {/* Pulsing brighter grid layer */}
          <div
            className="absolute inset-0 pointer-events-none animate-pulse-sync opacity-80"
            style={{
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Soft orange glowing core */}
        <style>{`
          @keyframes glowBreathe {
            0%, 100% { transform: scale(0.9); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 1.0; }
          }
          .glow-breathe { animation: glowBreathe 4s ease-in-out infinite; }
        `}</style>
        <div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.05) 0%, rgba(249, 115, 22, 0) 70%)'
          }}
        />

        <AnimatePresence mode="wait">
          {activeField && backgroundSVGs[activeField] && (
            <motion.div
              key={activeField}
              initial={{ y: 50, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 0.25, scale: 1 }}
              exit={{ y: -50, opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-[340px] h-[340px] flex items-center justify-center"
            >
              <svg
                viewBox={backgroundSVGs[activeField].viewBox}
                className="w-full h-full text-orange-500 filter drop-shadow-[0_0_15px_rgba(255,107,0,0.3)]"
                fill="none"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <defs>
                  <linearGradient id="corporate-orange" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff6b00" />
                    <stop offset="100%" stopColor="#ffa600" />
                  </linearGradient>
                </defs>
                {backgroundSVGs[activeField].paths.map((d, index) => (
                  <motion.path
                    key={index}
                    d={d}
                    stroke="url(#corporate-orange)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 1.2,
                      ease: "easeInOut",
                      delay: index * 0.08,
                    }}
                  />
                ))}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Glassmorphic blur frame container */}
        <div className="flex flex-col gap-5 rounded-2xl bg-surface-2/20 border border-white/5 p-6 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300">
          
          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('template')}
            onClickCapture={() => setActiveFieldDebounced('template')}
          >
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

          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('rootFolder')}
          >
            <Label htmlFor="rootFolder" className="text-sm font-medium text-foreground flex items-center gap-2 select-none cursor-pointer">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" /> Root Folder
            </Label>
            <Input
              id="rootFolder"
              value={reportingRootFolder}
              onChange={(e) => setReportingRootFolder(e.target.value)}
              placeholder="Root with P01, P02..."
              className="h-9 focus-visible:ring-orange-500"
            />
          </div>

          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('outputFolder')}
          >
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

          <div 
            className="flex flex-col gap-2 group/field"
            onFocusCapture={() => setActiveFieldDebounced('outputFilename')}
          >
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
            <div 
              className="flex flex-col gap-3 pt-3 border-t border-white/5 group/field"
              onFocusCapture={() => setActiveFieldDebounced('options')}
              onClickCapture={() => setActiveFieldDebounced('options')}
            >
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
                      onFocus={() => setActiveField('options')}
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