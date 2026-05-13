import { SystemBadge, StatusFooter, useSystemWebSocket } from './SystemBadge'

export function Header() {
  return (
    <header
      className="flex items-center h-[60px] bg-card border-b-2 px-5 shrink-0"
      style={{ borderColor: '#F39200' }}
    >
      <span className="text-xl font-bold text-foreground">Fusion Studio</span>
      <span className="text-xl font-bold ml-2" style={{ color: '#F39200' }}>
        Applus+ IDIADA
      </span>
      <div className="ml-auto">
        <SystemBadge />
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="h-[35px] bg-card border-t border-border/50 flex items-center px-4 shrink-0">
      <span className="text-[10px] text-muted-foreground">
        © 2026 Applus+ IDIADA | Licensed for Internal Use
      </span>
      <div className="ml-auto">
        <StatusFooter />
      </div>
    </footer>
  )
}

export { useSystemWebSocket }