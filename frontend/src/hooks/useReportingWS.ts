import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useReportingWS() {
  const { addLog, setReportingProcessing, setReportingStatus, setReportingOutputPath } = useAppStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host // includes port
    const url = `${protocol}//${host}/api/reporting/ws`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        switch (data.type) {
          case 'progress': setReportingStatus(data.message); addLog(`[Reporting] ${data.message}`); break
          case 'finished': {
            setReportingProcessing(false)
            setReportingStatus('Done!')
            setReportingOutputPath(data.output_path || '')
            addLog('[Reporting] Report generated successfully!')
            // Option B: re-scan the analysis directory so has_report badges refresh
            // in the sidebar. This is lightweight (filesystem walk only, no MDF reads).
            const { analysisSourcePath, setAnalysisResults } = useAppStore.getState()
            if (analysisSourcePath) {
              fetch('/api/analysis/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_dir: analysisSourcePath }),
              })
                .then(r => r.json())
                .then(d => {
                  if (d.results) setAnalysisResults(d.results)
                })
                .catch(() => { /* silent – badges just won't refresh this run */ })
            }
            break
          }
          case 'error': setReportingProcessing(false); setReportingStatus('Error'); addLog(`[Reporting] Error: ${data.message}`); break
        }
      } catch { /* ignore */ }
    }
    ws.onclose = () => { wsRef.current = null; if (mountedRef.current) reconnectRef.current = setTimeout(connect, 3000) }
    ws.onerror = () => ws.close()
  }, [addLog, setReportingProcessing, setReportingStatus, setReportingOutputPath])

  useEffect(() => {
    mountedRef.current = true; connect()
    return () => { mountedRef.current = false; if (reconnectRef.current) clearTimeout(reconnectRef.current); wsRef.current?.close() }
  }, [connect])
}
