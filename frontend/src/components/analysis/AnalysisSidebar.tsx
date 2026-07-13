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
  IdCardLanyard,
  ChevronsUpDown,
  LogOut,
  Settings,
  Download,
  RefreshCw,
  HelpCircle,
  Globe,
  ArrowUpCircle,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
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
  const { analysisActiveTab: activeTab, setAnalysisActiveTab: onTabChange } =
    useAppStore();
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
        transition={{
          duration: 0.3,
          type: "spring",
          stiffness: 300,
          damping: 15,
        }}
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
      <span
        className={cn(
          "text-left transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap",
          sidebarOpen
            ? "flex-1 opacity-100 max-w-[150px] ml-1"
            : "opacity-0 max-w-0 ml-0 pointer-events-none",
        )}
      >
        {label}
      </span>
      <ChevronRight
        className={cn(
          "shrink-0 transition-all duration-300",
          isExpanded && "rotate-90",
          sidebarOpen
            ? "w-3.5 h-3.5 opacity-100 scale-100"
            : "w-0 h-0 opacity-0 scale-0 pointer-events-none",
        )}
      />
    </SidebarMenuButton>
  );

  return (
    <div
      className={cn(
        "flex flex-col relative group/expandable",
        !sidebarOpen
          ? "w-10 mx-auto rounded-xl overflow-hidden"
          : "p-[1px] gap-0 w-full",
      )}
    >
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
        <div
          className={cn(
            "h-[1px] bg-border/50 relative z-10",
            sidebarOpen ? "mx-2 my-1" : "mx-0",
          )}
        />
      )}

      <motion.div
        initial={false}
        animate={isExpanded ? "open" : "collapsed"}
        variants={{
          open: {
            height: "auto",
            opacity: 1,
            transition: {
              height: {
                type: "spring",
                stiffness: 280,
                damping: 18,
              },
              opacity: { duration: 0.2 },
            },
          },
          collapsed: {
            height: 0,
            opacity: 0,
            transition: {
              height: { duration: 0.25, ease: "easeInOut" },
              opacity: { duration: 0.15 },
            },
          },
        }}
        className={cn(
          "flex flex-col overflow-hidden relative z-10",
          sidebarOpen ? "mt-0.5" : "mt-0",
        )}
      >
        {children.length > 0
          ? children.map((item) => (
              <SidebarMenuItem key={item.value}>
                <SidebarMenuButton
                  variant={activeTab === item.value ? "active" : "default"}
                  size="sm"
                  onClick={() => handleItemClick(item.value)}
                  className={cn("relative pl-10", !sidebarOpen && "pl-0")}
                >
                  <motion.div
                    animate={
                      activeTab === item.value
                        ? { scale: [0.8, 1.15, 1] }
                        : { scale: 1 }
                    }
                    transition={{
                      duration: 0.3,
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                    }}
                    className="flex shrink-0 items-center justify-center"
                  >
                    <item.icon className="w-4 h-4 shrink-0 transition-all duration-300" />
                  </motion.div>
                  <span
                    className={cn(
                      "transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-left flex-1",
                      sidebarOpen
                        ? "opacity-100 max-w-[150px] ml-1"
                        : "opacity-0 max-w-0 ml-0 pointer-events-none",
                    )}
                  >
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
          : sidebarOpen && (
              <div className="flex items-center gap-2 pl-10 pr-3 py-2 text-xs text-muted-foreground/50 italic">
                <Construction className="w-3 h-3" />
                <span>{emptyMessage || "Coming soon"}</span>
              </div>
            )}
      </motion.div>
    </div>
  );
}

function SidebarItem({
  value,
  label,
  icon: Icon,
  spinner,
}: {
  value: string;
  label: string;
  icon: any;
  spinner?: boolean;
}) {
  const { analysisActiveTab: activeTab, setAnalysisActiveTab: onTabChange } =
    useAppStore();
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
        transition={{
          duration: 0.3,
          type: "spring",
          stiffness: 300,
          damping: 15,
        }}
        className="flex shrink-0 items-center justify-center"
      >
        <Icon className="w-4 h-4 shrink-0 transition-all duration-300" />
      </motion.div>
      <span
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-left",
          sidebarOpen
            ? "flex-1 opacity-100 max-w-[150px] ml-1"
            : "opacity-0 max-w-0 ml-0 pointer-events-none",
        )}
      >
        {label}
      </span>
      {spinner && (
        <div
          className={cn(
            "transition-all duration-300",
            sidebarOpen ? "ml-auto" : "absolute right-1 top-1",
          )}
        >
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

interface CorporateUser {
  username: string | null;
  display_name: string | null;
  email: string | null;
  upn: string | null;
  resolved_identity: string | null;
  identity_source: string;
  is_email_confirmed: boolean;
  avatar_base64: string | null;
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
  const { isDark, toggleTheme } = useTheme();

  const [userProfile, setUserProfile] = useState<CorporateUser | null>(() => {
    try {
      const saved = localStorage.getItem("corporate_user_profile");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isHeaderLogoHovered, setIsHeaderLogoHovered] = useState(false);

  useEffect(() => {
    fetch("/api/user/me")
      .then((res) => res.json())
      .then((data) => {
        setUserProfile(data);
        try {
          localStorage.setItem("corporate_user_profile", JSON.stringify(data));
        } catch (e) {
          console.error("Failed to save user profile to localStorage", e);
        }
      })
      .catch((err) => console.error("Failed to fetch user profile", err));
  }, []);

  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => {
    if (["tracking", "audio", "time-selector", "logic"].includes(activeTab))
      return "Gaze Analysis";
    if (["occupant-time", "misuse-logic"].includes(activeTab))
      return "Occupant Monitoring";
    return null;
  });

  useEffect(() => {
    if (["tracking", "audio", "time-selector", "logic"].includes(activeTab)) {
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
    <Sidebar collapsible="icon" className="border-r-0 bg-background">
      {/* Persistent Sidebar Header */}
      <SidebarHeader className="h-[52px] flex items-center p-0 overflow-hidden shrink-0 relative w-full">
        <div className="flex items-center w-full px-[14px] h-full relative">
          <div
            className="w-8 h-8 flex items-center justify-center cursor-pointer select-none group/logo-sidebar shrink-0 relative animate-none hover:bg-white/10 dark:hover:bg-white/10 rounded-lg transition-colors"
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

      <SidebarContent
        className={cn(
          "py-3 px-2 flex flex-col gap-2 overflow-y-auto transition-all duration-300",
          !sidebarOpen && "px-1 gap-0",
        )}
      >
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
            <SidebarItem value="metadata" label="Metadata" icon={FileText} />
            <ExpandableGroup
              label="Gaze Analysis"
              icon={Eye}
              isExpanded={expandedGroup === "Gaze Analysis"}
              onToggle={() =>
                setExpandedGroup(
                  expandedGroup === "Gaze Analysis" ? null : "Gaze Analysis",
                )
              }
              children={[
                {
                  value: "tracking",
                  label: "Tracking",
                  icon: ScanFace,
                  showSpinner: analysisChronosRunning,
                },
                { value: "audio", label: "Audio", icon: Mic },
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
              onToggle={() =>
                setExpandedGroup(
                  expandedGroup === "Occupant Monitoring"
                    ? null
                    : "Occupant Monitoring",
                )
              }
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

      <SidebarFooter className={cn("p-2 shrink-0", !sidebarOpen && "px-1")}>
        <SidebarUserButton
          userProfile={userProfile}
          toggleTheme={toggleTheme}
          isDark={isDark}
          sidebarOpen={sidebarOpen}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

function LogSidebarButton({ isLogWriting }: { isLogWriting: boolean }) {
  const { analysisActiveTab: activeTab, setAnalysisActiveTab: onTabChange } =
    useAppStore();
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
        transition={{
          duration: 0.3,
          type: "spring",
          stiffness: 300,
          damping: 15,
        }}
        className="flex shrink-0 items-center justify-center"
      >
        <Terminal className="w-4 h-4 shrink-0 transition-all duration-300" />
      </motion.div>
      <span
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-left",
          sidebarOpen
            ? "flex-1 opacity-100 max-w-[150px] ml-1"
            : "opacity-0 max-w-0 ml-0 pointer-events-none",
        )}
      >
        Log
      </span>
      {isLogWriting && (
        <div
          className={cn(
            "transition-all duration-300 flex items-center justify-center shrink-0",
            sidebarOpen ? "ml-auto w-5 h-5" : "absolute right-1 top-1",
          )}
        >
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

function getInitials(name: string) {
  if (!name || name === "Guest" || name === "Loading...") return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function SidebarUserButton({
  userProfile,
  toggleTheme,
  isDark,
  sidebarOpen,
}: {
  userProfile: CorporateUser | null;
  toggleTheme: () => void;
  isDark: boolean;
  sidebarOpen: boolean;
}) {
  const username = userProfile?.username || "Guest";
  const displayName =
    userProfile?.display_name || userProfile?.email || username;
  const emailSubtext = userProfile?.email || userProfile?.upn || "";
  const badgeText = username.startsWith("AT") ? "IDI" : "EXT";

  const [updateInfo, setUpdateInfo] = useState<{
    available: boolean;
    version: string | null;
    installerPath: string | null;
  }>({
    available: false,
    version: null,
    installerPath: null,
  });

  const checkUpdates = useCallback(async (isStartup = false) => {
    if (isStartup && !navigator.onLine) {
      return; // Skip background check if offline on startup
    }

    const toastId = toast.loading(isStartup ? "Checking for updates in background..." : "Checking for updates...");
    try {
      const res = await fetch("/api/system/check-update");
      const data = await res.json();
      
      if (data.update_available) {
        toast.dismiss(toastId);
        setUpdateInfo({
          available: true,
          version: data.version,
          installerPath: data.installer_path,
        });
        
        toast.info(`Version ${data.version} is available!`, {
          duration: 10000,
          action: {
            label: "Install Now",
            onClick: () => handleInstallUpdate(data.installer_path),
          },
        });
      } else {
        toast.success(isStartup ? "Application is up to date." : "You are on the latest version.", { id: toastId });
        setUpdateInfo({
          available: false,
          version: null,
          installerPath: null,
        });
      }
    } catch (err) {
      toast.error("Failed to check for updates.", { id: toastId });
    }
  }, []);

  const handleInstallUpdate = async (installerPath: string) => {
    const toastId = toast.loading("Starting update process...");
    try {
      await fetch("/api/system/apply-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installer_path: installerPath })
      });
      toast.success("Update started. The application will close.", { id: toastId });
    } catch (err) {
      toast.error("Failed to start update.", { id: toastId });
    }
  };

  useEffect(() => {
    checkUpdates(true);
  }, [checkUpdates]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group w-full flex items-center rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none select-none",
            "hover:bg-[#E6E4E1] hover:text-[#111110] dark:hover:bg-primary/10 dark:hover:text-primary",
            sidebarOpen ? "h-14 p-2 gap-3 justify-start text-left" : "h-12 p-1.5 justify-center",
          )}
        >
          {/* Avatar Container */}
          <div className="relative shrink-0">
            <Avatar className={cn(
              "rounded-full bg-surface-3 transition-all duration-300",
              sidebarOpen ? "h-10 w-10" : "h-9 w-9"
            )}>
              {userProfile?.avatar_base64 ? (
                <AvatarImage
                  src={`data:image/jpeg;base64,${userProfile.avatar_base64}`}
                  alt={displayName}
                  className="object-cover rounded-full"
                />
              ) : null}
              <AvatarFallback
                className={cn(
                  "bg-transparent flex items-center justify-center font-black text-foreground select-none",
                  sidebarOpen ? "text-[12px]" : "text-[10px]",
                )}
              >
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            {updateInfo.available && (
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#F39200] rounded-full ring-2 ring-background z-30 animate-pulse" />
            )}
          </div>

          {/* Name & Chevron */}
          {sidebarOpen && (
            <div className="flex items-center flex-1 min-w-0 gap-2">
              <div className="flex flex-col min-w-0 flex-1 text-left gap-0.5">
                <span className="truncate font-bold text-foreground text-xs leading-none">
                  {displayName}
                </span>
                {emailSubtext && (
                  <span className="truncate text-[10px] text-muted-foreground font-normal normal-case leading-none">
                    {emailSubtext}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={sidebarOpen ? "start" : "end"}
        side={sidebarOpen ? "top" : "right"}
        sideOffset={sidebarOpen ? 8 : 12}
        className="w-56 bg-surface-2 border border-border text-foreground rounded-2xl shadow-xl p-1.5 z-[100]"
      >
        {/* User Header */}
        <div className="flex items-center gap-3 px-2 py-2 select-none">
          <div className="relative shrink-0">
            <div className="relative flex items-center justify-center rounded-full h-[42px] w-[42px]">
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="avatar-ring-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="50%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="url(#avatar-ring-grad)"
                  strokeWidth="4"
                />
              </svg>
              <Avatar className="h-[34px] w-[34px] rounded-full bg-surface-3 relative z-10">
                {userProfile?.avatar_base64 ? (
                  <AvatarImage
                    src={`data:image/jpeg;base64,${userProfile.avatar_base64}`}
                    alt={displayName}
                    className="object-cover rounded-full"
                  />
                ) : null}
                <AvatarFallback className="bg-transparent flex items-center justify-center font-black text-foreground select-none text-[11px]">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
            </div>
            {/* Badge overlay (IDI / EXT) */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-black text-white px-2 h-3.5 min-w-[26px] rounded-full font-black ring-2 ring-white shadow-md flex items-center justify-center text-center text-[10px] leading-none z-20">
              {badgeText}
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground truncate">
              {displayName}
            </span>
            {emailSubtext && emailSubtext !== displayName && (
              <span className="text-[11px] text-muted-foreground truncate">
                {emailSubtext}
              </span>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="my-1 border-t border-border/40" />

        {/* Items */}
        <DropdownMenuItem className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm hover:bg-white/5 cursor-pointer">
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1">All settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-t border-border/40" />

        {/* Theme Toggle Sub-menu inside Dropdown */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm hover:bg-white/5 data-[state=open]:bg-white/5 cursor-pointer text-foreground select-none">
            {isDark ? (
              <Moon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Sun className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="flex-1 text-left">Appearance</span>
            <span className="text-xs text-muted-foreground capitalize">
              {isDark ? "Dark" : "Light"}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="bg-surface-2 border border-border text-foreground rounded-2xl shadow-xl p-1.5 min-w-[8rem] z-[101]">
              <DropdownMenuItem
                onClick={() => {
                  if (!isDark) toggleTheme();
                }}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm cursor-pointer hover:bg-white/5 text-foreground",
                  isDark && "bg-white/5 font-semibold text-primary",
                )}
              >
                <Moon className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (isDark) toggleTheme();
                }}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-sm cursor-pointer hover:bg-white/5 text-foreground",
                  !isDark && "bg-white/5 font-semibold text-primary",
                )}
              >
                <Sun className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Light</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuItem className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm hover:bg-white/5 cursor-pointer">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1">Language</span>
          <span className="text-xs text-muted-foreground">Default</span>
        </DropdownMenuItem>

        <DropdownMenuItem className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm hover:bg-white/5 cursor-pointer">
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1">Help</span>
        </DropdownMenuItem>

        <DropdownMenuItem 
          onClick={() => {
            if (updateInfo.available && updateInfo.installerPath) {
              handleInstallUpdate(updateInfo.installerPath);
            } else {
              checkUpdates(false);
            }
          }}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm hover:bg-white/5 cursor-pointer"
        >
          <RefreshCw className={cn("w-4 h-4 text-muted-foreground", updateInfo.available && "animate-spin")} />
          <span className="flex-1">{updateInfo.available ? "Install update" : "Check for updates"}</span>
          {updateInfo.available && (
            <span className="w-2.5 h-2.5 bg-[#F39200] rounded-full animate-pulse shrink-0" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-t border-border/40" />

        <DropdownMenuItem
          onClick={() => window.location.reload()}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm hover:bg-red-500/10 text-red-500 hover:text-red-500 cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-500" />
          <span className="flex-1 font-semibold">Exit</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
