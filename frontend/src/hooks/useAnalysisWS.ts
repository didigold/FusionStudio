import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useAnalysisWS() {
  const { addLog, setAnalysisEventResult, setAnalysisChronosRunning, setAnalysisChronosProgress, setAnalysisChronosStats } = useAppStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = import.meta.env.DEV ? '8000' : window.location.port
    const url = `${protocol}//${host}:${port}/api/analysis/ws`

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
          case 'finished': setAnalysisChronosRunning(false); addLog('Chronos processing finished'); break
          case 'error': setAnalysisChronosRunning(false); addLog(`Chronos error: ${data.message}`); break
        }
      } catch { /* ignore */ }
    }
    ws.onclose = () => { wsRef.current = null; if (mountedRef.current) reconnectRef.current = setTimeout(connect, 3000) }
    ws.onerror = () => ws.close()
  }, [addLog, setAnalysisChronosProgress, setAnalysisChronosRunning, setAnalysisChronosStats, setAnalysisEventResult])

  useEffect(() => {
    mountedRef.current = true; connect()
    return () => { mountedRef.current = false; if (reconnectRef.current) clearTimeout(reconnectRef.current); wsRef.current?.close() }
  }, [connect])
}
