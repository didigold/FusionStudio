import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useClassifyWS() {
  const { addLog, setClassifyProgress, setClassifyStatus, setClassifyProcessing, classifyGroups, setClassifyGroups } = useAppStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const groupsRef = useRef(classifyGroups)
  groupsRef.current = classifyGroups

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = import.meta.env.DEV ? '8000' : window.location.port
    const url = `${protocol}//${host}:${port}/api/classification/ws`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        switch (data.type) {
          case 'progress': setClassifyProgress(data.value); break
          case 'status': setClassifyStatus(data.message); break
          case 'item_done': {
            const groups = groupsRef.current.map((g: any) => ({
              ...g,
              files: g.files.map((f: any) =>
                f.path === data.item_ref ? { ...f, status: data.success ? 'done' : 'error', error_msg: data.error || '' } : f
              ),
            }))
            setClassifyGroups(groups)
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
