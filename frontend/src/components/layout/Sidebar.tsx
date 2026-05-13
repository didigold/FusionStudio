import { NavLink } from 'react-router-dom'
import {
  FlaskConical,
  BarChart3,
  FolderKanban,
  FileText,
  Eye,
  BrainCircuit,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/fuse', icon: FlaskConical, label: 'Fuse' },
  { to: '/analysis', icon: BarChart3, label: 'Analysis' },
  { to: '/classification', icon: FolderKanban, label: 'Classification' },
  { to: '/reporting', icon: FileText, label: 'Reporting' },
  { to: '/om', icon: Eye, label: 'OM Analysis' },
  { to: '/brain', icon: BrainCircuit, label: 'AI Brain' },
]

export function Sidebar() {
  return (
    <nav className="w-[60px] bg-card border-r border-border/50 flex flex-col items-center py-3 gap-1.5 shrink-0">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          children={({ isActive }) => (
            <span
              className={`w-11 h-11 flex items-center justify-center rounded-lg text-[17px] transition-all duration-150
                ${isActive
                  ? 'bg-[#F39200] text-black shadow-md shadow-[#F3920040]'
                  : 'hover:bg-card text-[#999] hover:text-foreground'}`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            </span>
          )}
        />
      ))}
    </nav>
  )
}