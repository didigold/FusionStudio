import { useState, useEffect, useCallback } from "react";
import {
  Mic,
  FileText,
  Clock,
  GitBranch,
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useAppStore } from "@/store/useAppStore";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";

interface SubItem {
  value: string;
  label: string;
  icon: any;
  showSpinner?: boolean;
}

interface ExpandableGroupProps {
  label: string;
  icon: any;
  children: SubItem[];
  emptyMessage?: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function ExpandableGroup({
  label,
  icon: GroupIcon,
  children,
  emptyMessage,
  isExpanded,
  onToggle,
}: ExpandableGroupProps) {
  const { analysisActiveTab: activeTab, setAnalysisActiveTab: onTabChange } = useAppStore();
  const { open: sidebarOpen } = useSidebar();
  const isActive = children.some((c) => c.value === activeTab);

  const handleItemClick = useCallback(
    (value: string) => {
      onTabChange(value);
    },
    [onTabChange],
  );

  const groupButton = (
    <SidebarMenuButton
      size="sm"
      variant={isActive && !isExpanded ? "active" : "default"}
      onClick={() => {
        onToggle();
      }}
      className=""
    >
      <motion.div
        animate={isActive ? { scale: [0.8, 1.15, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 15 }}
        className="flex shrink-0 items-center justify-center relative"
      >
        <GroupIcon className="w-4 h-4 shrink-0 transition-all duration-300" />
        {!sidebarOpen && (
          <div className="absolute -bottom-1 -right-1 flex gap-[1px] items-center pointer-events-none">
            <span className="w-[2px] h-[2px] rounded-full bg-current opacity-70" />
            <span className="w-[2px] h-[2px] rounded-full bg-current opacity-70" />
            <span className="w-[2px] h-[2px] rounded-full bg-current opacity-70" />
          </div>
        )}
      </motion.div>
      <span className={cn(
        "text-left transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap",
        sidebarOpen ? "flex-1 opacity-100 max-w-[150px] ml-1" : "opacity-0 max-w-0 ml-0 pointer-events-none"
      )}>
        {label}
      </span>
      <ChevronRight
        className={cn(
          "shrink-0 transition-all duration-300",
          isExpanded && "rotate-90",
          sidebarOpen ? "w-3.5 h-3.5 opacity-100 scale-100" : "w-0 h-0 opacity-0 scale-0 pointer-events-none"
        )}
      />
    </SidebarMenuButton>
  );

  return (
    <div className={cn(
      "flex flex-col relative group/expandable",
      !sidebarOpen && isExpanded ? "w-10 mx-auto rounded-xl overflow-hidden" : "p-[1px] gap-0 w-full"
    )}>
      <AnimatePresence>
        {!sidebarOpen && isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 border border-primary/20 bg-primary/5 rounded-xl pointer-events-none z-20"
          />
        )}
      </AnimatePresence>
      <div className="relative z-10">
        {!sidebarOpen ? (
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuItem>{groupButton}</SidebarMenuItem>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <span className="text-xs font-bold">{label}</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <SidebarMenuItem>{groupButton}</SidebarMenuItem>
        )}
      </div>

      {isExpanded && (
        <div className={cn(
          "h-[1px] bg-border/50 relative z-10",
          sidebarOpen ? "mx-2 my-1" : "mx-0"
        )} />
      )}

      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out overflow-hidden relative z-10",
          isExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
          sidebarOpen ? "mt-0.5" : "mt-0"
        )}
      >
        {children.length > 0 ? (
          children.map((item) => (
            <SidebarMenuItem key={item.value}>
              <SidebarMenuButton
                variant={activeTab === item.value ? "active" : "default"}
                size="sm"
                onClick={() => handleItemClick(item.value)}
                className={cn(
                  "relative pl-10",
                  !sidebarOpen && "pl-0"
                )}
              >
                <motion.div
                  animate={activeTab === item.value ? { scale: [0.8, 1.15, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 15 }}
                  className="flex shrink-0 items-center justify-center"
                >
                  <item.icon className="w-4 h-4 shrink-0 transition-all duration-300" />
                </motion.div>
                <span className={cn(
                  "transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-left flex-1",
                  sidebarOpen ? "opacity-100 max-w-[150px] ml-1" : "opacity-0 max-w-0 ml-0 pointer-events-none"
                )}>
                  {item.label}
                </span>
                {item.showSpinner && sidebarOpen && (
                  <div className="absolute right-3">
                    <Spinner className="size-3 text-primary/60" />
                  </div>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        ) : (
          sidebarOpen && (
            <div className="flex items-center gap-2 pl-10 pr-3 py-2 text-xs text-muted-foreground/50 italic">
              <Construction className="w-3 h-3" />
              <span>{emptyMessage || "Coming soon"}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SidebarItem({ value, label, icon: Icon, spinner }: { value: string; label: string; icon: any; spinner?: boolean }) {
  const { analysisActiveTab: activeTab, setAnalysisActiveTab: onTabChange } = useAppStore();
  const { open: sidebarOpen } = useSidebar();
  const isActive = activeTab === value;

  const buttonContent = (
    <SidebarMenuButton
      variant={isActive ? "active" : "default"}
      size="sm"
      onClick={() => onTabChange(value)}
      className="relative"
    >
      <motion.div
        animate={isActive ? { scale: [0.8, 1.15, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 15 }}
        className="flex shrink-0 items-center justify-center"
      >
        <Icon className="w-4 h-4 shrink-0 transition-all duration-300" />
      </motion.div>
      <span className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-left",
        sidebarOpen ? "flex-1 opacity-100 max-w-[150px] ml-1" : "opacity-0 max-w-0 ml-0 pointer-events-none"
      )}>
        {label}
      </span>
      {spinner && (
        <div className={cn("transition-all duration-300", sidebarOpen ? "ml-auto" : "absolute right-1 top-1")}>
          <Spinner className="size-3 text-primary/60" />
        </div>
      )}
    </SidebarMenuButton>
  );

  if (!sidebarOpen) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuItem>{buttonContent}</SidebarMenuItem>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <span className="text-xs font-bold">{label}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <SidebarMenuItem>{buttonContent}</SidebarMenuItem>;
}

export function AnalysisSidebar() {
  const {
    analysisChronosRunning,
    analysisBatchRunning,
    classifyProcessing,
    reportingProcessing,
    fusionState,
    analysisActiveTab: activeTab,
  } = useAppStore();

  const { open: sidebarOpen, toggleSidebar } = useSidebar();
  const { isDark } = useTheme();
  const [isHeaderLogoHovered, setIsHeaderLogoHovered] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    if (["tracking", "time-selector", "logic"].includes(activeTab)) return "Gaze Analysis";
    if (["occupant-time", "misuse-logic"].includes(activeTab)) return "Occupant Monitoring";
    return null;
  });
  
  useEffect(() => {
    if (["tracking", "time-selector", "logic"].includes(activeTab)) {
      setExpandedGroup("Gaze Analysis");
    } else if (["occupant-time", "misuse-logic"].includes(activeTab)) {
      setExpandedGroup("Occupant Monitoring");
    } else {
      setExpandedGroup(null);
    }
  }, [activeTab]);

  const isLogWriting =
    analysisChronosRunning ||
    analysisBatchRunning ||
    classifyProcessing ||
    reportingProcessing ||
    fusionState !== "idle";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 bg-surface-1"
    >
      {/* Persistent Sidebar Header */}
      <SidebarHeader className="h-[52px] flex items-center p-0 overflow-hidden shrink-0 relative w-full">
        <div className="flex items-center w-full px-[14px] h-full relative">
          <div
            className="w-7 h-7 flex items-center justify-center cursor-pointer select-none group/logo-sidebar shrink-0 relative animate-none"
            onMouseEnter={() => setIsHeaderLogoHovered(true)}
            onMouseLeave={() => setIsHeaderLogoHovered(false)}
            onClick={toggleSidebar}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <AnimatePresence mode="wait">
              {!sidebarOpen && isHeaderLogoHovered ? (
                <motion.div
                  key="sidebar-panel-icon"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <PanelLeftOpen className="w-4 h-4 text-primary" />
                </motion.div>
              ) : (
                <motion.img
                  key="sidebar-logo-icon"
                  src="/assets/icon.ico"
                  alt="FusionStudio Logo"
                  className="w-5 h-5 object-contain"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    filter: isDark
                      ? "brightness(1.1) drop-shadow(0 0 6px rgba(255, 255, 255, 0.2))"
                      : "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15))",
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.1, ease: "easeInOut" }}
                className="flex items-center justify-between flex-1 min-w-0"
              >
                <span className="text-sm font-extrabold text-foreground tracking-wide whitespace-nowrap ml-2.5">
                  FusionStudio
                </span>
                <button
                  onClick={toggleSidebar}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-surface-3 hover:text-foreground transition-colors shrink-0"
                  title="Close sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SidebarHeader>

      <SidebarContent className={cn(
        "py-3 px-2 flex flex-col gap-2 overflow-y-auto transition-all duration-300",
        !sidebarOpen && "px-1 gap-0"
      )}>
        {/* File Customization */}
        <SidebarGroup>
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden flex flex-col shrink-0"
              >
                <div className="flex items-center pt-2 pb-1">
                  <SidebarGroupLabel className="whitespace-nowrap">
                    File Customization
                  </SidebarGroupLabel>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <SidebarMenu>
            <SidebarItem
              value="fuse"
              label="File Fusion"
              icon={Merge}
              spinner={fusionState !== "idle"}
            />
          </SidebarMenu>
        </SidebarGroup>

        {/* Analysis */}
        <SidebarGroup>
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden flex flex-col shrink-0"
              >
                <div className="flex items-center pt-2 pb-1">
                  <SidebarGroupLabel className="whitespace-nowrap">
                    Analysis
                  </SidebarGroupLabel>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <SidebarMenu>
            <SidebarItem value="audio" label="Audio" icon={Mic} />
            <SidebarItem value="metadata" label="Metadata" icon={FileText} />
            <ExpandableGroup
              label="Gaze Analysis"
              icon={Eye}
              isExpanded={expandedGroup === "Gaze Analysis"}
              onToggle={() => setExpandedGroup(expandedGroup === "Gaze Analysis" ? null : "Gaze Analysis")}
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
              isExpanded={expandedGroup === "Occupant Monitoring"}
              onToggle={() => setExpandedGroup(expandedGroup === "Occupant Monitoring" ? null : "Occupant Monitoring")}
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
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden flex flex-col shrink-0"
              >
                <div className="flex items-center pt-2 pb-1">
                  <SidebarGroupLabel className="whitespace-nowrap">
                    Documents
                  </SidebarGroupLabel>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <SidebarMenu>
            <SidebarItem
              value="classification"
              label="Classification"
              icon={Tags}
              spinner={classifyProcessing}
            />
            <SidebarItem
              value="reporting"
              label="Reporting"
              icon={FileSpreadsheet}
              spinner={reportingProcessing}
            />
          </SidebarMenu>
        </SidebarGroup>

        {/* Others */}
        <SidebarGroup>
          <AnimatePresence initial={false}>
            {sidebarOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden flex flex-col shrink-0"
              >
                <div className="flex items-center pt-2 pb-1">
                  <SidebarGroupLabel className="whitespace-nowrap">
                    Others
                  </SidebarGroupLabel>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <SidebarMenu>
            <SidebarItem value="models" label="HuMind" icon={Brain} />
            <SidebarMenuItem>
              <LogSidebarButton isLogWriting={isLogWriting} />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function LogSidebarButton({ isLogWriting }: { isLogWriting: boolean }) {
  const { analysisActiveTab: activeTab, setAnalysisActiveTab: onTabChange } = useAppStore();
  const { open: sidebarOpen } = useSidebar();
  const isActive = activeTab === "log";

  const buttonContent = (
    <SidebarMenuButton
      variant={isActive ? "active" : "default"}
      size="sm"
      onClick={() => onTabChange("log")}
      className="relative"
    >
      <motion.div
        animate={isActive ? { scale: [0.8, 1.15, 1] } : { scale: 1 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 15 }}
        className="flex shrink-0 items-center justify-center"
      >
        <Terminal className="w-4 h-4 shrink-0 transition-all duration-300" />
      </motion.div>
      <span className={cn(
        "transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-left",
        sidebarOpen ? "flex-1 opacity-100 max-w-[150px] ml-1" : "opacity-0 max-w-0 ml-0 pointer-events-none"
      )}>
        Log
      </span>
      {isLogWriting && (
        <div className={cn("transition-all duration-300 flex items-center justify-center shrink-0", sidebarOpen ? "ml-auto w-5 h-5" : "absolute right-1 top-1")}>
          {sidebarOpen ? (
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
          ) : (
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          )}
        </div>
      )}
    </SidebarMenuButton>
  );

  if (!sidebarOpen) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-full">{buttonContent}</div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            <span className="text-xs font-bold">Log</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <div className="w-full">{buttonContent}</div>;
}
