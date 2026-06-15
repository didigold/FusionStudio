import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'

export function useBrainTrainingWS() {
  const { addLog, setBrainTraining, setBrainPhase, setBrainPhaseProgress, addBrainEpochData, setBrainDatasetStats } = useAppStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const lastEpochTimeRef = useRef(0) // throttle epoch renders to ~10fps

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host // includes port
    const url = `${protocol}//${host}/api/brain/ws/training`

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
          case 'epoch': {
            const now = performance.now();
            if (now - lastEpochTimeRef.current >= 100) {
              lastEpochTimeRef.current = now;
              addBrainEpochData({
                epoch: data.epoch,
                loss: data.loss,
                acc: data.acc,
                val_loss: data.val_loss,
                val_acc: data.val_acc,
                train_f1: data.train_f1,
                val_f1: data.val_f1,
                lr: data.lr,
                epoch_time: data.epoch_time,
              })
            }
            break
          }
          case 'dataset_stats':
            setBrainDatasetStats(data);
            break
          case 'finished': setBrainTraining(false); setBrainPhase('done'); addLog('Training completed successfully!'); break
          case 'error': setBrainTraining(false); setBrainPhase('error'); addLog(`Error: ${data.message}`); break
        }
      } catch { /* ignore */ }
    }
    ws.onclose = () => { wsRef.current = null; if (mountedRef.current) reconnectRef.current = setTimeout(connect, 3000) }
    ws.onerror = () => ws.close()
  }, [addLog, setBrainTraining, setBrainPhase, setBrainPhaseProgress, addBrainEpochData, setBrainDatasetStats])

  useEffect(() => {
    mountedRef.current = true; connect()
    return () => { mountedRef.current = false; if (reconnectRef.current) clearTimeout(reconnectRef.current); wsRef.current?.close() }
  }, [connect])
}
