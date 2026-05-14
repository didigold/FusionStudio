import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/useAppStore'

export function SystemBadge() {
  const stats = useAppStore((s) => s.systemStats)
  if (!stats) {
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
          Connecting...
        </span>
      </div>
    )
  }

  const cpuColor = stats.cpu > 80 ? 'text-destructive' : stats.cpu > 50 ? 'text-warning' : 'text-success'

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className={cpuColor}>CPU {stats.cpu.toFixed(0)}%</span>
      <span>RAM {stats.ram_mb} MB</span>
      {stats.gpu_util > 0 && (
        <>
          <span>GPU {stats.gpu_util}%</span>
          <span>VRAM {stats.gpu_vram_mb} MB</span>
          <span>{stats.gpu_temp}°C</span>
        </>
      )}
    </div>
  )
}

export function StatusFooter() {
  const stats = useAppStore((s) => s.systemStats)
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      {stats ? (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          Connected
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          Disconnected
        </span>
      )}
    </div>
  )
}

export function useSystemWebSocket() {
  const setSystemStats = useAppStore((s) => s.setSystemStats)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host // includes port
    const url = `${protocol}//${host}/api/brain/ws/system`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'system_stats') setSystemStats(data)
      } catch { /* ignore */ }
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
  }, [setSystemStats])

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