import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useBrainTrainingWS() {
  const { addLog, setBrainTraining, setBrainPhase, setBrainPhaseProgress, addBrainEpochData } = useAppStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = import.meta.env.DEV ? '8000' : window.location.port
    const url = `${protocol}//${host}:${port}/api/brain/ws/train`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        switch (data.type) {
          case 'log': addLog(data.message); break
          case 'status':
            setBrainPhase(data.phase)
            if (data.progress != null) setBrainPhaseProgress(data.progress)
            break
          case 'progress': setBrainPhaseProgress(data.value); break
          case 'epoch':
            addBrainEpochData({ epoch: data.epoch, loss: data.loss, acc: data.acc, val_loss: data.val_loss, val_acc: data.val_acc })
            break
          case 'finished': setBrainTraining(false); setBrainPhase('done'); addLog('Training completed successfully!'); break
          case 'error': setBrainTraining(false); setBrainPhase('error'); addLog(`Error: ${data.message}`); break
        }
      } catch { /* ignore */ }
    }
    ws.onclose = () => { wsRef.current = null; if (mountedRef.current) reconnectRef.current = setTimeout(connect, 3000) }
    ws.onerror = () => ws.close()
  }, [addLog, setBrainTraining, setBrainPhase, setBrainPhaseProgress, addBrainEpochData])

  useEffect(() => {
    mountedRef.current = true; connect()
    return () => { mountedRef.current = false; if (reconnectRef.current) clearTimeout(reconnectRef.current); wsRef.current?.close() }
  }, [connect])
}
