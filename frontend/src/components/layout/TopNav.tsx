import { useState, useEffect } from "react";
import { FolderOpen, Loader2, X, Save, Cog, Trash2, Sun, Moon } from "lucide-react";
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

declare const __USERNAME__: string | undefined;

const userName = typeof __USERNAME__ !== "undefined" ? __USERNAME__ : "User";

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
  const [browseOpen, setBrowseOpen] = useState(false);
  const [promptedPath, setPromptedPath] = useState("");
  const [promptFolderBrowserOpen, setPromptFolderBrowserOpen] = useState(false);
  const [localPath, setLocalPath] = useState(analysisSourcePath);
  const [isFocused, setIsFocused] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

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
      setAnalysisResults(data.results || []);
      setAnalysisAvailableCameras(data.available_cameras || []);
      setAllAnalysisFiles(true);
      addLog(`Analysis scan found ${data.results?.length || 0} participants.`);
    } catch (err) {
      addLog(`Error scanning analysis dir: ${err}`);
    } finally {
      setScanning(false);
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

  return (
    <>
      <style>{`
        .nav-entry-wrapper {
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .nav-entry-wrapper .nav-clear-btn {
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, color 0.2s ease;
        }
        .nav-entry-wrapper:hover .nav-clear-btn {
          opacity: 1;
          pointer-events: auto;
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
      `}</style>
      <header className="relative w-full h-16 border-b border-border bg-background flex items-center justify-between px-8 z-40 sticky top-0">
        {/* Left Side: Brand Logo and Text */}
        <div className="flex items-center gap-2.5 shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="21"
            viewBox="0 0 48 46"
            fill="none"
            className="text-foreground"
          >
            <path
              fill="currentColor"
              d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"
            />
          </svg>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-foreground tracking-wide">
              FusionStudio
            </span>
            <span className="text-sm text-muted-foreground font-medium">|</span>
            <img
              src="/assets/logos/APPLUS+IDIADA.png"
              alt="Applus Idiada"
              className="h-[36px] object-contain opacity-80"
              style={{ filter: isDark ? "brightness(0) invert(1)" : "brightness(0)" }}
            />
          </div>
        </div>

        {/* Center: Data Source Input Area (Fixed Position) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
          <div
            className={cn(
              "nav-entry-wrapper relative w-[600px] h-9 flex items-center bg-surface-2 border rounded-lg px-2 transition-all shadow-inner",
              isFocused
                ? "border-orange-500 ring-1 ring-orange-500/20"
                : !analysisSourcePath
                  ? "border-orange-500/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]"
                  : "border-border",
            )}
          >
            <input
              type="text"
              value={localPath}
              onChange={(e) => setLocalPath(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pendingConfig) {
                    confirmPromptedPath(localPath);
                  } else {
                    setAnalysisSourcePath(localPath);
                    triggerScanForPath(localPath);
                  }
                }
              }}
              onBlur={() => {
                setIsFocused(false);
                if (pendingConfig) {
                  if (localPath !== analysisSourcePath) {
                    confirmPromptedPath(localPath);
                  }
                } else {
                  setAnalysisSourcePath(localPath);
                  triggerScanForPath(localPath);
                }
              }}
              placeholder="Select project folder..."
              style={{ outline: "none", border: "none", boxShadow: "none" }}
              className="bg-transparent text-xs text-foreground/90 placeholder:text-muted-foreground/50 w-full pl-2 pr-2"
            />
            {analysisSourcePath && (
              <button
                type="button"
                onClick={() => setClearConfirmOpen(true)}
                className="nav-clear-btn p-1 hover:bg-foreground/5 text-muted-foreground hover:text-foreground rounded-md transition-all mr-1"
                title="Clear Path"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Browse button */}
          <Button
            type="button"
            onClick={() => setBrowseOpen(true)}
            variant="outline"
            size="icon"
            className="w-9 h-9 rounded-lg border border-border bg-surface-2 text-foreground hover:bg-accent hover:border-accent transition-all shrink-0"
            title="Browse Folder"
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Right Side: Import/Save Config buttons and User Profile */}
        <div className="flex items-center gap-3 shrink-0 justify-end ml-auto">
          {/* Import / Save Config + Theme Toggle — unified icon group */}
          <div className="flex items-center gap-1.5">
            {/* Import Config */}
            <Button
              type="button"
              onClick={() =>
                document.getElementById("global-import-config-input")?.click()
              }
              variant="outline"
              size="icon"
              className="w-9 h-9 rounded-lg border border-border bg-surface-2 text-foreground hover:bg-accent hover:border-accent transition-all shrink-0"
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

            {/* Save Config */}
            <Button
              type="button"
              onClick={exportConfig}
              variant="outline"
              size="icon"
              className="w-9 h-9 rounded-lg border border-border bg-surface-2 text-foreground hover:bg-accent hover:border-accent transition-all shrink-0"
              title="Save Configuration JSON"
            >
              <Save className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>

            {/* Theme Toggle */}
            <Button
              type="button"
              onClick={toggleTheme}
              variant="outline"
              size="icon"
              className="w-9 h-9 rounded-lg border border-border bg-surface-2 text-foreground hover:bg-accent transition-all shrink-0"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-muted-foreground transition-transform hover:rotate-12 duration-200" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-muted-foreground transition-transform hover:-rotate-12 duration-200" />
              )}
            </Button>
          </div>

          <div className="h-6 w-[1px] bg-border" />

          {/* User profile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8 hover:bg-foreground/5"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-surface-3 text-foreground">
                    {userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 bg-surface-2 border-border text-foreground"
            >
              <div className="px-2 py-2 text-xs font-bold text-muted-foreground border-b border-border">
                {userName}
              </div>
              <DropdownMenuItem className="cursor-default text-muted-foreground text-xs hover:bg-transparent">
                Accredited user
              </DropdownMenuItem>
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
