import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { toast } from 'sonner'

export function useAnalysisWS() {
  const { addLog, setAnalysisEventResult, setAnalysisChronosRunning, setAnalysisChronosProgress, setAnalysisChronosStats, setAnalysisChronosFrame } = useAppStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host // includes port
    const url = `${protocol}//${host}/api/analysis/ws`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        switch (data.type) {
          case 'log': addLog(data.message); break
          case 'progress': setAnalysisChronosProgress(data.value); break
          case 'task_done': addLog(`Task done: ${data.path}`); break
          case 'stats': setAnalysisChronosStats(data); break
          case 'frame': setAnalysisChronosFrame(data.data); break
          case 'finished': 
            if (useAppStore.getState().analysisChronosRunning) {
              setAnalysisChronosRunning(false); 
              addLog('Chronos processing finished');
              toast.success("Chronos finished", {
                description: "Tracking data has been successfully generated."
              });
            }
            break
          case 'error': 
            if (useAppStore.getState().analysisChronosRunning) {
              setAnalysisChronosRunning(false); 
              addLog(`Chronos error: ${data.message}`);
              toast.error("Chronos error", {
                description: data.message
              });
            }
            break
        }
      } catch { /* ignore */ }
    }
    ws.onclose = () => { wsRef.current = null; if (mountedRef.current) reconnectRef.current = setTimeout(connect, 3000) }
    ws.onerror = () => ws.close()
  }, [addLog, setAnalysisChronosProgress, setAnalysisChronosRunning, setAnalysisChronosStats, setAnalysisChronosFrame, setAnalysisEventResult])

  useEffect(() => {
    mountedRef.current = true; connect()
    return () => { mountedRef.current = false; if (reconnectRef.current) clearTimeout(reconnectRef.current); wsRef.current?.close() }
  }, [connect])
}
