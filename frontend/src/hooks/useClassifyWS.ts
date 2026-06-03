import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useClassifyWS() {
  const addLog = useAppStore(state => state.addLog)
  const setClassifyProgress = useAppStore(state => state.setClassifyProgress)
  const setClassifyStatus = useAppStore(state => state.setClassifyStatus)
  const setClassifyProcessing = useAppStore(state => state.setClassifyProcessing)
  const setClassifyGroups = useAppStore(state => state.setClassifyGroups)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const lastProgressTimeRef = useRef(0) // throttle progress to ~10fps

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host // includes port
    const url = `${protocol}//${host}/api/classification/ws`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        switch (data.type) {
          case 'progress': {
            const now = performance.now();
            if (now - lastProgressTimeRef.current >= 100) {
              lastProgressTimeRef.current = now;
              setClassifyProgress(data.value);
            }
            break
          }
          case 'status': setClassifyStatus(data.message); break
          case 'item_done': {
            const latestGroups = useAppStore.getState().classifyGroups
            const groups = latestGroups.map((g: any) => ({
              ...g,
              files: g.files.map((f: any) =>
                f.path === data.item_ref ? { ...f, status: data.success ? 'done' : 'error', error_msg: data.error || '' } : f
              ),
            }))
            setClassifyGroups(groups)
            if (data.success) {
              addLog(`Successfully classified, renamed and moved case: ${data.case_full_name}`)
            } else {
              addLog(`Failed to process case ${data.case_full_name || data.item_ref}: ${data.error || 'Unknown error'}`)
            }
            break
          }
          case 'finished': setClassifyProcessing(false); setClassifyProgress(100); setClassifyStatus('Done'); addLog('Classification complete'); break
          case 'error': setClassifyProcessing(false); addLog(`Error: ${data.message}`); break
        }
      } catch { /* ignore */ }
    }
    ws.onclose = () => { wsRef.current = null; if (mountedRef.current) reconnectRef.current = setTimeout(connect, 3000) }
    ws.onerror = () => ws.close()
  }, [addLog, setClassifyProgress, setClassifyStatus, setClassifyProcessing, setClassifyGroups])

  useEffect(() => {
    mountedRef.current = true; connect()
    return () => { mountedRef.current = false; if (reconnectRef.current) clearTimeout(reconnectRef.current); wsRef.current?.close() }
  }, [connect])
}
