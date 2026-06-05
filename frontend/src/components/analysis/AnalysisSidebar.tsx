import { useState, useEffect, useCallback } from "react";
import {
  Mic,
  FileText,
  Clock,
  GitBranch,
  Package,
  AlertTriangle,
  BrainCircuit,
  Tags,
  FileSpreadsheet,
  Terminal,
  Eye,
  UserCheck,
  ChevronRight,
  Construction,
  ScanFace,
  Merge,
  Brain,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAppStore } from "@/store/useAppStore";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface SubItem {
  value: string;
  label: string;
  icon: any;
  showSpinner?: boolean;
}

interface ExpandableGroupProps {
  label: string;
  icon: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: SubItem[];
  emptyMessage?: string;
}

function ExpandableGroup({
  label,
  icon: GroupIcon,
  activeTab,
  onTabChange,
  children,
  emptyMessage,
}: ExpandableGroupProps) {
  const isActive = children.some((c) => c.value === activeTab);
  const [isExpanded, setIsExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setIsExpanded(true);
  }, [isActive]);

  const toggle = useCallback(() => setIsExpanded((e) => !e), []);

  const handleItemClick = useCallback(
    (value: string) => {
      onTabChange(value);
    },
    [onTabChange],
  );

  return (
    <div className="flex flex-col">
      <SidebarMenuItem>
        <SidebarMenuButton
          size="sm"
          onClick={toggle}
          className={cn(isActive && "bg-surface-2 text-foreground shadow-sm")}
        >
          <GroupIcon className="w-4 h-4" />
          <span className="flex-1 text-left">{label}</span>
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        </SidebarMenuButton>
      </SidebarMenuItem>
      {isExpanded && (
        <div className="flex flex-col">
          {children.length > 0 ? (
            children.map((item) => (
              <SidebarMenuItem key={item.value}>
                <SidebarMenuButton
                  variant={activeTab === item.value ? "active" : "default"}
                  size="sm"
                  onClick={() => handleItemClick(item.value)}
                  className="pl-10"
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.showSpinner && (
                    <Spinner className="size-3 text-primary/60 ml-auto" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          ) : (
            <div className="flex items-center gap-2 pl-10 pr-3 py-2 text-xs text-muted-foreground/50 italic">
              <Construction className="w-3 h-3" />
              <span>{emptyMessage || "Coming soon"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface AnalysisSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AnalysisSidebar({
  activeTab,
  onTabChange,
}: AnalysisSidebarProps) {
  const {
    analysisChronosRunning,
    analysisBatchRunning,
    classifyProcessing,
    reportingProcessing,
    fusionState,
  } = useAppStore();

  const isLogWriting =
    analysisChronosRunning ||
    analysisBatchRunning ||
    classifyProcessing ||
    reportingProcessing ||
    fusionState !== "idle";

  return (
    <Sidebar
      collapsible="none"
      className="border-r border-border/50 bg-surface-2/50"
    >
      <SidebarContent>
        {/* File Customization */}
        <SidebarGroup>
          <SidebarGroupLabel>File Customization</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant={activeTab === "fuse" ? "active" : "default"}
                size="sm"
                onClick={() => onTabChange("fuse")}
              >
                <Merge className="w-4 h-4" />
                <span>File Fusion</span>
                {fusionState !== "idle" && (
                  <Spinner className="size-3 text-primary/60 ml-auto" />
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Analysis */}
        <SidebarGroup>
          <SidebarGroupLabel>Analysis</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant={activeTab === "audio" ? "active" : "default"}
                size="sm"
                onClick={() => onTabChange("audio")}
              >
                <Mic className="w-4 h-4" />
                <span>Audio</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant={activeTab === "metadata" ? "active" : "default"}
                size="sm"
                onClick={() => onTabChange("metadata")}
              >
                <FileText className="w-4 h-4" />
                <span>Metadata</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <ExpandableGroup
              label="Gaze Analysis"
              icon={Eye}
              activeTab={activeTab}
              onTabChange={onTabChange}
              children={[
                {
                  value: "tracking",
                  label: "Tracking",
                  icon: ScanFace,
                  showSpinner: analysisChronosRunning,
                },
                { value: "time-selector", label: "Gaze Time", icon: Clock },
                {
                  value: "logic",
                  label: "Gaze Logic",
                  icon: GitBranch,
                  showSpinner: analysisBatchRunning,
                },
              ]}
            />

            <ExpandableGroup
              label="Occupant Monitoring"
              icon={UserCheck}
              activeTab={activeTab}
              onTabChange={onTabChange}
              children={[
                {
                  value: "occupant-time",
                  label: "Misuse Time",
                  icon: AlertTriangle,
                },
                {
                  value: "misuse-logic",
                  label: "Misuse Logic",
                  icon: BrainCircuit,
                },
              ]}
            />
          </SidebarMenu>
        </SidebarGroup>

        {/* Documents */}
        <SidebarGroup>
          <SidebarGroupLabel>Documents</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant={activeTab === "classification" ? "active" : "default"}
                size="sm"
                onClick={() => onTabChange("classification")}
              >
                <Tags className="w-4 h-4" />
                <span>Classification</span>
                {classifyProcessing && (
                  <Spinner className="size-3 text-primary/60 ml-auto" />
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant={activeTab === "reporting" ? "active" : "default"}
                size="sm"
                onClick={() => onTabChange("reporting")}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Reporting</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Others */}
        <SidebarGroup>
          <SidebarGroupLabel>Others</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant={activeTab === "models" ? "active" : "default"}
                size="sm"
                onClick={() => onTabChange("models")}
              >
                <Brain className="w-4 h-4" />
                <span>HuMind</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                variant={activeTab === "log" ? "active" : "default"}
                size="sm"
                onClick={() => onTabChange("log")}
              >
                <Terminal className="w-4 h-4" />
                <span>Log</span>
                {isLogWriting && (
                  <div className="w-5 h-5 ml-auto flex items-center justify-center shrink-0">
                    <svg
                      fill="currentColor"
                      className="text-primary w-4 h-4"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="4" cy="12" r="3" opacity="1">
                        <animate
                          id="spinner_qYjJ"
                          begin="0;spinner_t4KZ.end-0.25s"
                          attributeName="opacity"
                          dur="0.75s"
                          values="1;.2"
                          fill="freeze"
                        />
                      </circle>
                      <circle cx="12" cy="12" r="3" opacity=".4">
                        <animate
                          begin="spinner_qYjJ.begin+0.15s"
                          attributeName="opacity"
                          dur="0.75s"
                          values="1;.2"
                          fill="freeze"
                        />
                      </circle>
                      <circle cx="20" cy="12" r="3" opacity=".3">
                        <animate
                          id="spinner_t4KZ"
                          begin="spinner_qYjJ.begin+0.3s"
                          attributeName="opacity"
                          dur="0.75s"
                          values="1;.2"
                          fill="freeze"
                        />
                      </circle>
                    </svg>
                  </div>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
