import { NavLink } from 'react-router-dom'
import { SystemBadge } from './SystemBadge'
import {
  FlaskConical,
  BarChart3,
  FolderKanban,
  FileText,
  Eye,
  BrainCircuit,
  Search
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/fuse', icon: FlaskConical, label: 'Fuse' },
  { to: '/analysis', icon: BarChart3, label: 'Analysis' },
  { to: '/classification', icon: FolderKanban, label: 'Classification' },
  { to: '/reporting', icon: FileText, label: 'Reporting' },
  { to: '/om', icon: Eye, label: 'OM Analysis' },
  { to: '/brain', icon: BrainCircuit, label: 'AI Brain' },
]

export function TopNav() {
  return (
    <div className="w-full flex justify-center px-6 mt-6 absolute top-0 z-50 pointer-events-none">
      <nav className="bg-[#201E1C] shadow-[0_4px_24px_rgba(0,0,0,0.25)] rounded-full px-10 py-3 flex items-center justify-between pointer-events-auto max-w-7xl w-full border border-border/50">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-2 shrink-0 w-64">
          <span className="text-[16px] font-bold text-foreground">FusionStudio</span>
          <span className="text-[16px] font-bold text-warning">Applus+ </span>
        </div>

        {/* Primary Links */}
        <div className="flex items-center gap-10">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `text-[16px] transition-colors relative ${
                  isActive
                    ? 'font-bold text-foreground'
                    : 'font-medium text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-warning" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Right side: Search/Badge */}
        <div className="flex items-center gap-4 shrink-0 w-64 justify-end">
          <SystemBadge />
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent border border-transparent hover:border-border transition-colors text-foreground">
            <Search size={18} />
          </button>
        </div>

      </nav>
    </div>
  )
}
