import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, Loader2, X, Save, Cog, Trash2, Folder, HardDrive, ChevronRight, Monitor, Download, FileText, Image, Music, Video, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";
import { FolderBrowser } from "@/components/analysis/FolderBrowser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme, saveSystemSettings } from "@/hooks/useTheme";

interface DirEntry {
  name: string
  is_dir: boolean
  is_drive?: boolean
  is_shortcut?: boolean
  full_path?: string
}

const shortcutIcons: Record<string, any> = {
  Desktop: Monitor,
  Escritorio: Monitor,
  Downloads: Download,
  Descargas: Download,
  Documents: FileText,
  Documentos: FileText,
  Pictures: Image,
  Imágenes: Image,
  Music: Music,
  Música: Music,
  Videos: Video,
  Vídeos: Video,
};

function getEntryIcon(entry: DirEntry) {
  if (entry.is_drive) return HardDrive;
  if (entry.is_shortcut) return shortcutIcons[entry.name] || Folder;
  return Folder;
}





const PLACEHOLDERS = [
  "Select project folder...",
  "Point to your sensor data directory...",
  "Ready to analyze? Select target folder...",
  "Feed me some telemetry data...",
  "Locate your signal files...",
  "Where is the magic hidden? Choose folder...",
  "Path to your next data workspace..."
];


export function TopNav() {
  const {
    analysisSourcePath,
    setAnalysisSourcePath,
    setAnalysisResults,
    setAnalysisAvailableCameras,
    setAllAnalysisFiles,
    setAnalysisSelectedFile,
    addLog,

    // Config actions & states
    importConfigJSON,
    exportConfig,
    handleUnmountConfig,
    isPromptingForPath,
    setIsPromptingForPath,
    pendingConfig,
    confirmPromptedPath,
  } = useAppStore();

  const { toggleTheme, isDark, getThemeStyle } = useTheme();




  const [scanning, setScanning] = useState(false);

  // Lightweight CSS placeholder cycling — no GSAP, no per-char state updates
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [placeholderPhase, setPlaceholderPhase] = useState<'typing' | 'visible' | 'erasing' | 'pause'>('typing');
  const [displayText, setDisplayText] = useState("");
  const rafRef = useRef<number>(0);
  const phaseRef = useRef(placeholderPhase);
  phaseRef.current = placeholderPhase;

  useEffect(() => {
    const fullText = PLACEHOLDERS[phraseIndex];
    let charIdx = 0;
    let lastTime = 0;

    if (placeholderPhase === 'typing') {
      charIdx = 0;
      const typeChar = (time: number) => {
        if (phaseRef.current !== 'typing') return;
        if (time - lastTime >= 35) {
          lastTime = time;
          charIdx++;
          setDisplayText(fullText.slice(0, charIdx));
          if (charIdx >= fullText.length) {
            setPlaceholderPhase('visible');
            return;
          }
        }
        rafRef.current = requestAnimationFrame(typeChar);
      };
      rafRef.current = requestAnimationFrame(typeChar);
    } else if (placeholderPhase === 'visible') {
      const timer = setTimeout(() => setPlaceholderPhase('erasing'), 2000);
      return () => clearTimeout(timer);
    } else if (placeholderPhase === 'erasing') {
      charIdx = fullText.length;
      const eraseChar = (time: number) => {
        if (phaseRef.current !== 'erasing') return;
        if (time - lastTime >= 20) {
          lastTime = time;
          charIdx--;
          setDisplayText(fullText.slice(0, charIdx));
          if (charIdx <= 0) {
            setPlaceholderPhase('pause');
            return;
          }
        }
        rafRef.current = requestAnimationFrame(eraseChar);
      };
      rafRef.current = requestAnimationFrame(eraseChar);
    } else if (placeholderPhase === 'pause') {
      const timer = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setPlaceholderPhase('typing');
      }, 400);
      return () => clearTimeout(timer);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [placeholderPhase, phraseIndex]);




  const [promptedPath, setPromptedPath] = useState("");
  const [promptFolderBrowserOpen, setPromptFolderBrowserOpen] = useState(false);
  const [localPath, setLocalPath] = useState(analysisSourcePath);
  const [isFocused, setIsFocused] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<"import" | "save" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSubmittedPathRef = useRef<string>(analysisSourcePath || "");

  useEffect(() => {
    lastSubmittedPathRef.current = analysisSourcePath || "";
  }, [analysisSourcePath]);

  const handleSubmitPath = (path: string) => {
    const trimmed = (path || "").trim();
    if (!trimmed) return;
    if (trimmed === lastSubmittedPathRef.current.trim()) return;

    lastSubmittedPathRef.current = trimmed;
    if (pendingConfig) {
      confirmPromptedPath(trimmed);
    } else {
      setAnalysisSourcePath(trimmed);
      triggerScanForPath(trimmed);
    }
  };

  const pathParts = localPath ? localPath.split(/[\\/]/).filter(Boolean) : [];
  const buildPath = (index: number, parts: string[]) => {
    const sep = localPath.includes("\\") ? "\\" : "/";
    const prefix = localPath.startsWith("\\") ? "\\" : localPath.startsWith("/") ? "/" : "";
    let result = prefix + parts.slice(0, index + 1).join(sep);
    if (parts[0]?.endsWith(":") && index === 0) {
      result += sep;
    }
    return result;
  };

  // States for folder browsing integrated in dropdown
  const [browseEntries, setBrowseEntries] = useState<DirEntry[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState("");

  useEffect(() => {
    if (!dropdownOpen) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBrowseLoading(true);
      setBrowseError("");
      try {
        const res = await fetch("/api/analysis/browse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ path: localPath }),
        });
        const data = await res.json();
        if (data.error) {
          setBrowseError(data.error);
          setBrowseEntries([]);
        } else {
          setBrowseEntries(data.entries || []);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setBrowseError("Failed to browse directory");
          setBrowseEntries([]);
        }
      } finally {
        setBrowseLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [localPath, dropdownOpen]);

  const handleClearOrRevert = () => {
    if (isPathChanged) {
      setLocalPath(analysisSourcePath || "");
    } else {
      setClearConfirmOpen(true);
    }
  };


  useEffect(() => {
    const loadRecent = () => {
      const recent = localStorage.getItem("recent_projects");
      if (recent) {
        try {
          const parsed = JSON.parse(recent);
          if (Array.isArray(parsed)) {
            setRecentProjects(
              parsed.filter((p) => typeof p === "string" && p.trim() !== ""),
            );
          }
        } catch (e) {
          setRecentProjects([]);
        }
      }
    };
    loadRecent();

    window.addEventListener("storage", loadRecent);
    window.addEventListener("system-settings-synced", loadRecent);
    return () => {
      window.removeEventListener("storage", loadRecent);
      window.removeEventListener("system-settings-synced", loadRecent);
    };
  }, []);

  const addToRecentProjects = (path: string) => {
    if (!path || typeof path !== "string" || !path.trim()) return;
    const cleanedPath = path.trim();
    const recent = localStorage.getItem("recent_projects");
    let list: string[] = [];
    if (recent) {
      try {
        list = JSON.parse(recent);
      } catch (e) {
        list = [];
      }
    }
    if (!Array.isArray(list)) list = [];
    list = list.filter((p) => p !== cleanedPath);
    list.unshift(cleanedPath);
    list = list.slice(0, 5);
    localStorage.setItem("recent_projects", JSON.stringify(list));
    setRecentProjects(list);
    saveSystemSettings({ recent_projects: list });
  };

  useEffect(() => {
    if (analysisSourcePath) {
      addToRecentProjects(analysisSourcePath);
    }
  }, [analysisSourcePath]);

  // Keep localPath in sync with store changes (e.g. folder browser or config loaded)
  useEffect(() => {
    setLocalPath(analysisSourcePath);
  }, [analysisSourcePath]);

  // Pre-populate promptedPath when pendingConfig/analysisSourcePath changes
  useEffect(() => {
    if (isPromptingForPath) {
      setPromptedPath(
        pendingConfig?.analysis_source_path || analysisSourcePath || "",
      );
    }
  }, [isPromptingForPath, pendingConfig, analysisSourcePath]);

  const triggerScanForPath = async (path: string) => {
    if (!path) return;
    setScanning(true);
    try {
      const res = await fetch("/api/analysis/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_dir: path }),
      });
      const data = await res.json();
      
      // Prevent race conditions: discard scan results if the user switched projects
      if (useAppStore.getState().analysisSourcePath !== path) {
        return;
      }
      
      setAnalysisResults(data.results || []);
      setAnalysisAvailableCameras(data.available_cameras || []);
      setAllAnalysisFiles(true);
      addLog(`Analysis scan found ${data.results?.length || 0} participants.`);
    } catch (err) {
      addLog(`Error scanning analysis dir: ${err}`);
    } finally {
      // Only disable scanning indicator if this is still the active project
      if (useAppStore.getState().analysisSourcePath === path) {
        setScanning(false);
      }
    }
  };

  const handleFolderSelect = (path: string) => {
    if (pendingConfig) {
      confirmPromptedPath(path);
    } else {
      setAnalysisSourcePath(path);
      triggerScanForPath(path);
    }
  };

  const handleClearPath = () => {
    setAnalysisSourcePath("");
    setLocalPath("");
    setAnalysisResults([]);
    setAnalysisAvailableCameras([]);
    setAnalysisSelectedFile("");
    setAllAnalysisFiles(false);
    handleUnmountConfig();
    addLog("Analysis source path cleared.");
  };

  const handleConfirmPromptedPath = async () => {
    if (!promptedPath) return;
    const success = await confirmPromptedPath(promptedPath);
    if (success) {
      // On success, isPromptingForPath is set to false in store
    }
  };

  const isPathChanged = !!localPath && localPath.trim() !== (analysisSourcePath || "").trim();

  return (
    <>
      <style>{`
        .nav-entry-wrapper {
          transition: width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav-entry-wrapper .nav-clear-btn {
          max-width: 0;
          overflow: hidden;
          pointer-events: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: max-width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav-entry-wrapper:hover .nav-clear-btn {
          max-width: 32px;
          pointer-events: auto;
        }

        .nav-input-area {
          position: relative;
          flex: 1;
          min-width: 0;
          height: 100%;
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .nav-entry-wrapper:has(.nav-clear-btn:hover) {
          background-color: color-mix(in srgb, var(--surface-2) 85%, #ef4444 15%) !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
        }
        .nav-entry-wrapper:has(.nav-clear-btn:hover) input {
          color: #ef4444 !important;
        }
        .nav-entry-wrapper:has(.nav-clear-btn:hover) .nav-clear-btn {
          color: #ef4444 !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }

        @keyframes spin-fast {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .hover-spin-fast:hover svg {
          animation: spin-fast 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          animation-delay: 0.25s;
        }

        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        .hover-bounce-subtle:hover svg {
          animation: bounce-subtle 0.7s ease-in-out infinite;
          animation-delay: 0.1s;
        }

        @keyframes sun-spin {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.1); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .hover-sun-spin:hover svg {
          animation: sun-spin 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          animation-delay: 0.25s;
        }
      `}</style>
      <header className="relative w-full h-[52px] bg-background flex items-center justify-between px-8 z-40 sticky top-0" style={getThemeStyle()}>
        {/* Backdrop overlay for focus shading */}
        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/60 z-40 pointer-events-auto"
              onMouseDown={() => {
                setDropdownOpen(false);
                setIsFocused(false);
              }}
            />
          )}
        </AnimatePresence>

        {/* Left Side: Empty placeholder (previously Applus Idiada Logo) */}
        <div className="flex items-center gap-2.5 shrink-0 select-none w-10 h-9" />


        {/* Center: Data Source Input Area (Fixed Position) */}
        <div className="absolute left-1/2 -translate-x-1/2 z-50">
          <div className="relative">
            <div
              className={cn(
                "nav-entry-wrapper relative flex items-center bg-surface-2 border px-2 shadow-inner transition-all duration-300",
                dropdownOpen
                  ? "h-11 shadow-md w-[680px] hover:w-[680px] focus-within:w-[680px] rounded-t-xl rounded-b-none border-t-orange-500 border-x-orange-500 border-b-border/40 z-50"
                  : analysisSourcePath || localPath
                    ? "h-9 w-[560px] hover:w-[600px] focus-within:w-[680px] rounded-lg border-border z-10"
                    : "h-9 w-[600px] hover:w-[600px] focus-within:w-[680px] rounded-lg border-border z-10",
                isFocused && !dropdownOpen
                  ? "border-orange-500 ring-1 ring-orange-500/20"
                  : !analysisSourcePath && !dropdownOpen
                    ? "border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]"
                    : "",
              )}
            >
              <div className="nav-input-area">
                <input
                  ref={inputRef}
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  onFocus={() => {
                    setIsFocused(true);
                    setDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                      setDropdownOpen(false);
                      handleSubmitPath(localPath);
                    }
                  }}
                  onBlur={() => {
                    // Delay so mousedown on dropdown items fires before we hide the dropdown
                    setTimeout(() => {
                      setIsFocused(false);
                      setDropdownOpen(false);
                      handleSubmitPath(inputRef.current?.value || "");
                    }, 150);
                  }}
                  placeholder=""
                  style={{ outline: "none", border: "none", boxShadow: "none" }}
                  className={cn(
                    "bg-transparent text-foreground/90 w-full pl-2 pr-2 relative z-10 transition-all duration-300",
                    dropdownOpen ? "text-lg" : "text-base"
                  )}
                />
                {/* Custom animated placeholder — CSS typewriter */}
                {!localPath && (
                  <div className={cn(
                    "absolute inset-y-0 left-2 right-2 flex items-center pointer-events-none text-muted-foreground/50 select-none z-0 transition-[font-size] duration-300",
                    dropdownOpen ? "text-lg" : "text-base"
                  )}>
                    <span className="font-normal truncate">
                      {displayText}
                      <span className="inline-block w-[1px] h-[1em] bg-muted-foreground/30 ml-[1px] align-middle animate-pulse" />
                    </span>
                  </div>
                )}

              </div>
              <div className="flex items-center gap-1.5 shrink-0 z-20">
                {scanning && (
                  <div className="p-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  </div>
                )}
                {!scanning && isPathChanged && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border border-border/60 bg-surface-3 text-xs font-bold text-muted-foreground select-none pointer-events-none uppercase tracking-wider font-mono shadow-sm">
                    <span>Enter</span>
                    <span className="text-sm font-bold">↵</span>
                  </span>
                )}
                {(analysisSourcePath || localPath) && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClearOrRevert}
                    className="nav-clear-btn p-1 hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-md"
                    title={isPathChanged ? "Revert Changes" : "Clear Path"}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Panel */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ 
                    height: { type: "spring", stiffness: 350, damping: 25 },
                    opacity: { duration: 0.15 }
                  }}
                  className={cn(
                    "absolute left-0 top-full w-full bg-surface-2/95 backdrop-blur-md border-x border-b border-t-0 rounded-b-xl shadow-2xl z-[100] text-foreground flex flex-col overflow-hidden origin-top",
                    dropdownOpen ? "border-orange-500" : "border-border"
                  )}
                >
                  <div className="flex flex-col w-full" style={{ maxHeight: '450px' }}>
                    {/* Recent Projects Section */}
                  <div className="shrink-0 flex flex-col">
                    <div className="px-4 py-2.5 text-sm font-bold text-foreground/80 select-none bg-surface-3/5">
                      Recent Projects
                    </div>
                    {recentProjects.length > 0 ? (
                      <div className="p-1.5 flex flex-col gap-0.5">
                        {recentProjects.map((path) => (
                          <button
                            key={path}
                            type="button"
                            onMouseDown={(e) => {
                              // Prevent blur from firing before click
                              e.preventDefault();
                              setLocalPath(path);
                              setDropdownOpen(false);
                              setIsFocused(false);
                              inputRef.current?.blur();
                              handleSubmitPath(path);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-sm text-foreground/80 hover:text-foreground hover:bg-white/5 active:bg-white/10 transition-colors group"
                          >
                            <span className="truncate text-sm opacity-90">{path}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="h-9 px-4 text-sm text-muted-foreground/40 italic select-none flex items-center justify-center">
                        No recent projects
                      </div>
                    )}
                  </div>

                  {/* Browse Folder Section */}
                  <div className="flex-1 flex flex-col min-h-0 border-t border-border/40">
                    <div className="px-4 py-2.5 text-sm font-bold text-foreground/80 select-none bg-surface-3/5 shrink-0">
                      Browse Folder
                    </div>

                    {/* Integrated Breadcrumb for browsing */}
                    {localPath && (
                      <div className="px-4 py-1.5 border-b border-border/20 bg-surface-3/10 shrink-0 flex items-center min-h-[1.75rem] overflow-x-auto select-none">
                        <Breadcrumb>
                          <BreadcrumbList className="flex-wrap">
                            <BreadcrumbItem>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setLocalPath("");
                                }}
                                className="flex items-center gap-1 p-0.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                              >
                                <Home className="w-4 h-4" />
                              </button>
                            </BreadcrumbItem>
                            {pathParts.map((part, i) => {
                              const isLast = i === pathParts.length - 1;
                              return (
                                <React.Fragment key={i}>
                                  <BreadcrumbSeparator className="text-muted-foreground/30 text-xs" />
                                  <BreadcrumbItem>
                                    {isLast ? (
                                      <span className="text-sm font-medium text-foreground max-w-[120px] truncate">{part}</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          setLocalPath(buildPath(i, pathParts));
                                        }}
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors max-w-[120px] truncate p-0.5 rounded hover:bg-white/5"
                                      >
                                        {part}
                                      </button>
                                    )}
                                  </BreadcrumbItem>
                                </React.Fragment>
                              );
                            })}
                          </BreadcrumbList>
                        </Breadcrumb>
                      </div>
                    )}
                    
                    <div className="flex-1 overflow-y-auto p-1.5 max-h-[220px]">
                      {browseLoading && browseEntries.length === 0 ? (
                        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Loading directory...
                        </div>
                      ) : browseError ? (
                        <div className="px-4 py-3 text-sm text-red-400 select-none text-center">
                          {browseError}
                        </div>
                      ) : browseEntries.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground/50 italic text-center select-none">
                          Empty folder
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {browseEntries.map((entry) => {
                            const Icon = getEntryIcon(entry);
                            return (
                              <button
                                key={entry.name + (entry.full_path || "")}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // keep input focused
                                  // Update path
                                  let nextPath = "";
                                  if (entry.full_path) {
                                    nextPath = entry.full_path;
                                  } else if (localPath) {
                                    const sep = localPath.includes("\\") ? "\\" : "/";
                                    const trail = localPath.endsWith("\\") || localPath.endsWith("/") ? "" : sep;
                                    nextPath = localPath + trail + entry.name;
                                  } else {
                                    nextPath = entry.name;
                                  }
                                  setLocalPath(nextPath);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left text-sm text-foreground/80 hover:text-foreground hover:bg-white/5 active:bg-white/10 transition-colors group"
                              >
                                <Icon className="w-4 h-4 shrink-0 text-primary/60" />
                                <span className="truncate text-sm opacity-90">{entry.name}</span>
                                <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Import/Save Config buttons */}
        <div className="flex items-center gap-2 shrink-0 justify-end ml-auto">
          {/* Import / Save Config + Theme Toggle — unified icon group */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-surface-2 shadow-sm overflow-hidden h-9">
              <motion.button
                type="button"
                onMouseEnter={() => setHoveredBtn("import")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={() =>
                  document.getElementById("global-import-config-input")?.click()
                }
                className="h-full flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground transition-colors shrink-0 outline-none select-none border-r border-border/40 hover-spin-fast"
                animate={{
                  width: hoveredBtn === "import" ? "150px" : "38px",
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 18,
                }}
              >
                <div className="flex items-center justify-center gap-2 overflow-hidden px-2 whitespace-nowrap">
                  <Cog className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <AnimatePresence initial={false}>
                    {hoveredBtn === "import" && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Import settings
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
              <input
                type="file"
                id="global-import-config-input"
                className="hidden"
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    const fileContent = event.target?.result as string;
                    await importConfigJSON(fileContent, file.name);
                  };
                  reader.readAsText(file);
                  e.target.value = ""; // Reset
                }}
              />

              <motion.button
                type="button"
                onMouseEnter={() => setHoveredBtn("save")}
                onMouseLeave={() => setHoveredBtn(null)}
                onClick={exportConfig}
                className="h-full flex items-center justify-center text-foreground hover:bg-accent hover:text-accent-foreground transition-colors shrink-0 outline-none select-none hover-bounce-subtle"
                animate={{
                  width: hoveredBtn === "save" ? "135px" : "38px",
                }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 18,
                }}
              >
                <div className="flex items-center justify-center gap-2 overflow-hidden px-2 whitespace-nowrap">
                  <Save className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <AnimatePresence initial={false}>
                    {hoveredBtn === "save" && (
                      <motion.span
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground shrink-0"
                      >
                        Save settings
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* CLEAR PATH CONFIRM DIALOG */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent className="max-w-[340px] border border-border bg-popover/80 backdrop-blur-xl p-6 text-center flex flex-col items-center gap-4 rounded-3xl shadow-2xl text-foreground">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
            <Trash2 className="w-5 h-5" />
          </div>
          <AlertDialogHeader className="items-center text-center gap-1.5">
            <AlertDialogTitle className="text-base font-bold text-foreground uppercase tracking-wider">
              Clear Project Folder?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground max-w-[280px]">
              This action will clear the loaded project path and reset all analysis results and cameras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-center gap-3 w-full mt-2">
            <AlertDialogCancel className="flex-1 bg-secondary border border-border hover:bg-secondary/80 text-secondary-foreground rounded-xl py-2 px-4 text-xs font-bold transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleClearPath();
                setClearConfirmOpen(false);
              }}
              className="flex-1 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 text-red-500 rounded-xl py-2 px-4 text-xs font-bold transition-all shadow-lg shadow-red-500/5"
            >
              Clear Folder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* FALLBACK PATH PROMPT DIALOG */}
      <Dialog open={isPromptingForPath} onOpenChange={setIsPromptingForPath}>
        <DialogContent className="bg-surface-2 border-white/10 text-foreground w-[520px] max-w-[95vw] rounded-2xl overflow-hidden shadow-2xl p-0">
          <DialogHeader className="p-5 pb-3 border-b border-white/5 bg-surface-3/30 text-left">
            <DialogTitle className="text-sm font-bold uppercase text-foreground/90 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-warning" /> Configure Project
              Path
            </DialogTitle>
          </DialogHeader>

          <div className="p-5 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The imported configuration requires a valid project source
              directory to automatically scan and load signals.
              {pendingConfig?.analysis_source_path && (
                <span className="block mt-2 font-mono text-xs text-orange-400 bg-orange-500/5 border border-orange-500/10 p-2.5 rounded-lg break-all">
                  Configured path not found:{" "}
                  {pendingConfig.analysis_source_path}
                </span>
              )}
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select Project Directory
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder="c:/path/to/project/folder..."
                    value={promptedPath}
                    onChange={(e) => setPromptedPath(e.target.value)}
                    className="h-9 bg-surface-3 border-white/10 text-sm rounded-lg placeholder:text-muted-foreground/40"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => setPromptFolderBrowserOpen(true)}
                  variant="outline"
                  className="h-9 rounded-lg border border-white/10 bg-surface-3 text-white hover:bg-white/5 transition-all px-3"
                  title="Browse Folder"
                >
                  <FolderOpen className="w-4 h-4 text-zinc-400" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 pt-2 border-t border-white/5 bg-surface-3/30 flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsPromptingForPath(false)}
              className="h-8 border-white/10 hover:bg-white/5 text-foreground font-bold uppercase text-[10px] tracking-widest rounded-lg px-4"
            >
              Cancel
            </Button>
            <Button
              disabled={!promptedPath}
              onClick={handleConfirmPromptedPath}
              className="h-8 bg-white text-black hover:bg-white/90 disabled:opacity-50 font-bold uppercase text-[10px] tracking-widest rounded-lg px-4"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FolderBrowser
        open={promptFolderBrowserOpen}
        onOpenChange={setPromptFolderBrowserOpen}
        onSelect={(path) => {
          setPromptedPath(path);
          setPromptFolderBrowserOpen(false);
        }}
      />
    </>
  );
}
