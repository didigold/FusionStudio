import { Mic, FileText, Video, Focus, GitBranch, Terminal, ChevronRight } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const navItems = [
  { value: "audio", label: "Audio", icon: Mic },
  { value: "report", label: "Report", icon: FileText },
  { value: "tracking", label: "Tracking", icon: Video },
  { value: "time-selector", label: "Time Selector", icon: Focus },
  { value: "logic", label: "Logic", icon: GitBranch },
  { value: "log", label: "Log", icon: Terminal },
]

interface AnalysisSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function AnalysisSidebar({ activeTab, onTabChange }: AnalysisSidebarProps) {
  return (
    <Sidebar collapsible="none" className="border-r border-border/50 bg-surface-2/50">
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.value} className="group">
                <SidebarMenuButton
                  variant={activeTab === item.value ? "active" : "default"}
                  size="sm"
                  onClick={() => onTabChange(item.value)}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="font-medium">{item.label}</span>
                  <ChevronRight className={cn(
                    "ml-auto w-3.5 h-3.5 transition-transform duration-200",
                    activeTab === item.value ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1 group-hover:opacity-50 group-hover:translate-x-0"
                  )} />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
