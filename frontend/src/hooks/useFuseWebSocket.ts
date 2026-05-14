import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useFuseWebSocket() {
  const {
    addLog,
    setGlobalProgress,
    updateParticipantProgress,
    updateParticipantStatus,
    setFusionState,
    setCleaningMem,
    setParticipants,
  } = useAppStore()

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host // includes port
    const url = `${protocol}//${host}/api/fuse/ws`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        switch (data.type) {
          case 'log':
            addLog(data.message)
            break
          case 'progress':
            setGlobalProgress(data.value)
            break
          case 'participant_progress':
            updateParticipantProgress(data.name, data.percent)
            break
          case 'participant_status':
            updateParticipantStatus(data.name, data.status)
            break
          case 'cleaning_mem':
            setCleaningMem(data.active)
            break
          case 'finished':
            setFusionState('idle')
            setGlobalProgress(1)
            addLog('--- Batch process finished ---')
            break
          case 'error':
            setFusionState('idle')
            addLog(`ERROR: ${data.message}`)
            break
        }
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => {
      wsRef.current = null
      if (mountedRef.current) {
        reconnectTimerRef.current = setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [addLog, setGlobalProgress, updateParticipantProgress, updateParticipantStatus, setFusionState, setCleaningMem, setParticipants])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])
}