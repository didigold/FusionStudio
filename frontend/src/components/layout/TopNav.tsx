import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FolderOpen, Loader2, X, Save, Cog, Trash2, Sun, Moon, Clock, IdCardLanyard, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/store/useAppStore";
import { FolderBrowser } from "@/components/analysis/FolderBrowser";
import { SplitText } from "@/components/ui/SplitText";
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
import { useTheme } from "@/hooks/useTheme";



const PLACEHOLDERS = [
  "Select project folder...",
  "Point to your sensor data directory...",
  "Ready to analyze? Select target folder...",
  "Feed me some telemetry data...",
  "Locate your signal files...",
  "Where is the magic hidden? Choose folder...",
  "Path to your next data workspace..."
];

const renderStaticText = (text: string) => {
  const words = text.split(' ');
  return words.map((word, wIdx) => (
    <span key={wIdx} className="inline-block whitespace-nowrap mr-[0.25em]">
      {word.split('').map((char, cIdx) => (
        <span key={cIdx} className="inline-block">
          {char}
        </span>
      ))}
    </span>
  ));
};

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

  const { toggleTheme, isDark } = useTheme();

  const [scanning, setScanning] = useState(false);
  const [userProfile, setUserProfile] = useState<{username: string}>({username: "Loading..."});

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [placeholderStatus, setPlaceholderStatus] = useState<'entering' | 'waiting' | 'deleting' | 'idle'>('entering');
  const [deletingText, setDeletingText] = useState("");

  const handleEntranceComplete = () => {
    setPlaceholderStatus('waiting');
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (placeholderStatus === 'waiting') {
      timer = setTimeout(() => {
        setDeletingText(PLACEHOLDERS[phraseIndex]);
        setPlaceholderStatus('deleting');
      }, 2000); // Stay for 2s after animation completes
    } else if (placeholderStatus === 'idle') {
      timer = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setPlaceholderStatus('entering');
      }, 500); // 0.5s pause before starting next SplitText
    }
    return () => clearTimeout(timer);
  }, [placeholderStatus, phraseIndex]);

  useEffect(() => {
    if (placeholderStatus !== 'deleting') return;

    let currentText = PLACEHOLDERS[phraseIndex];
    let interval = setInterval(() => {
      if (currentText.length > 0) {
        currentText = currentText.slice(0, -1);
        setDeletingText(currentText);
      } else {
        clearInterval(interval);
        setPlaceholderStatus('idle');
      }
    }, 25);

    return () => clearInterval(interval);
  }, [placeholderStatus, phraseIndex]);

  useEffect(() => {
    fetch("/api/user/me")
      .then(res => res.json())
      .then(data => setUserProfile({username: data.username}))
      .catch(err => console.error("Failed to fetch user profile", err));
  }, []);

  const [browseOpen, setBrowseOpen] = useState(false);
  const [promptedPath, setPromptedPath] = useState("");
  const [promptFolderBrowserOpen, setPromptFolderBrowserOpen] = useState(false);
  const [localPath, setLocalPath] = useState(analysisSourcePath);
  const [isFocused, setIsFocused] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
    return () => window.removeEventListener("storage", loadRecent);
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
          transition: background-color 0.2s ease, border-color 0.2s ease, width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .nav-entry-wrapper .nav-clear-btn {
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          pointer-events: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: max-width 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease, color 0.2s ease;
        }
        .nav-entry-wrapper:hover .nav-clear-btn,
        .nav-entry-wrapper:focus-within .nav-clear-btn {
          max-width: 32px;
          opacity: 1;
          pointer-events: auto;
        }
        .nav-fade-right {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 40px;
          pointer-events: none;
          z-index: 1;
          border-radius: 0 6px 6px 0;
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
          background-color: rgba(239, 68, 68, 0.15) !important;
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
      <header className="relative w-full h-[52px] bg-background flex items-center justify-between px-8 z-40 sticky top-0">
        {/* Left Side: Empty placeholder (previously Applus Idiada Logo) */}
        <div className="flex items-center gap-2.5 shrink-0 select-none w-10 h-9" />


        {/* Center: Data Source Input Area (Fixed Position) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center -space-x-px z-10">
          <div className="relative">
            <div
              className={cn(
                "nav-entry-wrapper relative h-9 flex items-center bg-surface-2 border rounded-l-lg rounded-r-none px-2 shadow-inner",
                analysisSourcePath
                  ? "w-[560px] hover:w-[600px] focus-within:w-[600px]"
                  : "w-[600px]",
                isFocused
                  ? "border-orange-500 ring-1 ring-orange-500/20 z-20"
                  : !analysisSourcePath
                    ? "border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.15)] z-10"
                    : "border-border z-10",
              )}
            >
              <div className="nav-input-area">
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  onFocus={() => {
                    setIsFocused(true);
                    setDropdownOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setDropdownOpen(false);
                      if (pendingConfig) {
                        confirmPromptedPath(localPath);
                      } else {
                        setAnalysisSourcePath(localPath);
                        triggerScanForPath(localPath);
                      }
                    }
                  }}
                  onBlur={() => {
                    // Delay so mousedown on dropdown items fires before we hide the dropdown
                    setTimeout(() => {
                      setIsFocused(false);
                      setDropdownOpen(false);
                    }, 150);
                  }}
                  placeholder=""
                  style={{ outline: "none", border: "none", boxShadow: "none" }}
                  className="bg-transparent text-sm text-foreground/90 w-full pl-2 pr-2 relative z-10"
                />
                {/* Custom animated placeholder */}
                {!localPath && (
                  <div className="absolute inset-y-0 left-2 right-2 flex items-center pointer-events-none text-sm text-muted-foreground/50 select-none z-0">
                    {placeholderStatus === 'entering' || placeholderStatus === 'waiting' ? (
                      <SplitText
                        text={PLACEHOLDERS[phraseIndex]}
                        className="text-sm font-normal text-muted-foreground/50"
                        delay={40}
                        duration={0.5}
                        ease="power2.out"
                        splitType="chars"
                        from={{ opacity: 0, y: 15 }}
                        to={{ opacity: 1, y: 0 }}
                        textAlign="left"
                        onLetterAnimationComplete={handleEntranceComplete}
                      />
                    ) : placeholderStatus === 'deleting' ? (
                      <div
                        className="split-parent text-sm font-normal text-muted-foreground/50"
                        style={{
                          textAlign: 'left',
                          overflow: 'hidden',
                          display: 'inline-block',
                          whiteSpace: 'normal',
                          wordWrap: 'break-word',
                        }}
                      >
                        {renderStaticText(deletingText)}
                      </div>
                    ) : null}
                  </div>
                )}
                {/* Fade overlay — right edge */}
                <div
                  className="nav-fade-right"
                  style={{
                    background: "linear-gradient(to right, transparent, var(--surface-2))",
                  }}
                />
              </div>
              {analysisSourcePath && (
                <button
                  type="button"
                  onClick={() => setClearConfirmOpen(true)}
                  className="nav-clear-btn p-1 hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-md transition-all"
                  title="Clear Path"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Recent Projects Dropdown */}
            <AnimatePresence>
              {dropdownOpen && recentProjects.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute left-0 top-full mt-1.5 w-full bg-surface-2/95 backdrop-blur-md border border-border rounded-xl shadow-2xl z-[100] text-foreground overflow-hidden"
                >
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-b border-border/40 select-none flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Recent Projects
                  </div>
                  <div className="p-1 flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
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
                          if (pendingConfig) {
                            confirmPromptedPath(path);
                          } else {
                            setAnalysisSourcePath(path);
                            triggerScanForPath(path);
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs text-foreground/80 hover:text-foreground hover:bg-white/5 active:bg-white/10 transition-colors group"
                      >
                        <span className="truncate font-mono text-xs opacity-90">{path}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Browse button or Submit arrow */}
          <Button
            type="button"
            onClick={() => {
              if (isPathChanged) {
                if (pendingConfig) {
                  confirmPromptedPath(localPath);
                } else {
                  setAnalysisSourcePath(localPath);
                  triggerScanForPath(localPath);
                }
              } else {
                setBrowseOpen(true);
              }
            }}
            variant="outline"
            className="w-10 h-9 rounded-r-lg rounded-l-none border border-border bg-surface-2 text-foreground hover:bg-accent hover:border-accent transition-all shrink-0 z-10"
            title={isPathChanged ? "Load Project Path" : "Browse Folder"}
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : isPathChanged ? (
              <ArrowRight className="w-3.5 h-3.5 text-primary animate-pulse" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Right Side: Import/Save Config buttons and User Profile */}
        <div className="flex items-center gap-2 shrink-0 justify-end ml-auto">
          {/* Import / Save Config + Theme Toggle — unified icon group */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={() =>
                document.getElementById("global-import-config-input")?.click()
              }
              variant="outline"
              className="w-10 h-9 rounded-lg border border-border bg-surface-2 text-foreground hover:bg-accent hover:border-accent transition-all shrink-0 hover-spin-fast"
              title="Import Configuration JSON"
            >
              <Cog className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
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

            <Button
              type="button"
              onClick={exportConfig}
              variant="outline"
              className="w-10 h-9 rounded-lg border border-border bg-surface-2 text-foreground hover:bg-accent hover:border-accent transition-all shrink-0 hover-bounce-subtle"
              title="Save Configuration JSON"
            >
              <Save className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>

            <Button
              type="button"
              onClick={toggleTheme}
              variant="outline"
              className="w-10 h-9 rounded-lg border border-border bg-surface-2 text-foreground hover:bg-accent transition-all shrink-0 hover-sun-spin"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                className="h-9 pl-2 pr-1.5 py-1 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all flex items-center gap-2 shadow-sm"
              >
                <span className="text-[13px] font-bold tracking-wider uppercase px-2.5">
                  {userProfile.username === "AT017769"
                    ? "GOAT"
                    : userProfile.username?.startsWith("AT")
                    ? "STAFF"
                    : "GUEST"}
                </span>
                <Avatar className="h-[26px] w-[26px]">
                  <AvatarFallback className="bg-background text-foreground flex items-center justify-center">
                    <IdCardLanyard className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[120px] bg-surface-2 border-border text-foreground"
            >
              <div className="px-3 py-2 text-sm font-bold text-muted-foreground text-center">
                {userProfile.username}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
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
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        onSelect={handleFolderSelect}
      />
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
