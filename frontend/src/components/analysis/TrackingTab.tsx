import { Fragment, useCallback, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Play, Square, Video, StopCircle, CircleGauge, MoveHorizontal, MoveVertical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { analysisApi } from "@/api/analysisApi";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TrackingTab() {
  const {
    analysisSourcePath,
    analysisAvailableCameras,
    analysisSelectedCamera,
    setAnalysisSelectedCamera,
    analysisCheckedFiles,
    analysisChronosRunning,
    setAnalysisChronosRunning,
    analysisGamificationFilter,
    setAnalysisGamificationFilter,
    analysisChronosProgress,
    analysisChronosStats,
    analysisChronosFrame,
    addLog,
  } = useAppStore();

  const [showAmbilight, setShowAmbilight] = useState(true);
  const [ambilightColor, setAmbilightColor] = useState('0,0,0');
  const lastFrameRef = useRef<string | null>(null);

  // Sample dominant color from frame using a tiny offscreen canvas
  useEffect(() => {
    if (!analysisChronosFrame || analysisChronosFrame === lastFrameRef.current) return;
    lastFrameRef.current = analysisChronosFrame;
    if (!showAmbilight) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 4; c.height = 4;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 4, 4);
      const d = ctx.getImageData(0, 0, 4, 4).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
      const px = d.length / 4;
      setAmbilightColor(`${Math.round(r/px)},${Math.round(g/px)},${Math.round(b/px)}`);
    };
    img.src = `data:image/jpeg;base64,${analysisChronosFrame}`;
  }, [analysisChronosFrame, showAmbilight]);

  // Dynamically update the gamification filter while tracking is running
  useEffect(() => {
    if (analysisChronosRunning) {
      analysisApi.updateChronosFilter(analysisGamificationFilter).catch((err) => {
        console.error("Failed to update active filter dynamically", err);
      });
    }
  }, [analysisGamificationFilter, analysisChronosRunning]);

  const availableCameras = analysisAvailableCameras;

  const startTracking = useCallback(async () => {
    try {
      const res = await analysisApi.runChronos(
        analysisCheckedFiles,
        analysisSelectedCamera,
        analysisSourcePath,
        analysisGamificationFilter
      );
      if (res.data.status === "started") {
        setAnalysisChronosRunning(true);
        addLog(`Chronos started: ${res.data.task_count} task(s)`);
      } else if (res.data.status === "no_tasks") {
        addLog("No tasks could be resolved from the selected files");
      } else if (res.data.status === "already_running") {
        addLog("Tracking is already running");
      }
    } catch {
      addLog("Failed to start tracking");
    }
  }, [
    analysisCheckedFiles,
    analysisSelectedCamera,
    analysisSourcePath,
    analysisGamificationFilter,
    setAnalysisChronosRunning,
    addLog,
  ]);

  const stopTracking = useCallback(async () => {
    try {
      await analysisApi.stopChronos();
      setAnalysisChronosRunning(false);
      addLog("Tracking stopped");
    } catch {
      addLog("Failed to stop tracking");
    }
  }, [setAnalysisChronosRunning, addLog]);

  const stats = analysisChronosStats || {
    h_val: 0,
    v_val: 0,
    fps: 0,
    frame: 0,
    total_frames: 0,
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500 h-full">
      <style>{`
        @keyframes pulseSmoothSync {
          0%, 100% {
            opacity: 0.25;
            filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0));
            color: rgba(255, 255, 255, 0.35);
          }
          50% {
            opacity: 0.95;
            filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 25px rgba(255, 255, 255, 0.25));
            color: rgba(255, 255, 255, 0.95);
          }
        }
        .animate-pulse-sync {
          animation: pulseSmoothSync 3s ease-in-out infinite;
        }
      `}</style>

        {/* Header - Aligned with Video Viewport */}
        <div className="w-full flex items-center justify-between relative min-h-[48px]">
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground truncate max-w-[250px]">
                {stats.file ||
                  analysisCheckedFiles[0]?.split(/[\\/]/).pop() ||
                  "No file selected"}
              </span>
              <span className="text-xs text-muted-foreground">
                {stats.frame || 0} / {stats.total_frames || 0} frames
              </span>
            </div>
          </div>

        <div className="flex items-center gap-3">
          <ButtonGroup>
            {availableCameras.length > 0 ? (
              availableCameras.map((cam, i) => (
                <Fragment key={cam}>
                  {i > 0 && <ButtonGroupSeparator />}
                  <Button
                    variant={
                      analysisSelectedCamera === cam ? "default" : "ghost"
                    }
                    size="sm"
                    className={cn(
                      "h-7 px-3 rounded-lg text-sm font-bold transition-all",
                      analysisSelectedCamera === cam
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-surface-2",
                    )}
                    onClick={() => setAnalysisSelectedCamera(cam)}
                  >
                    cam{cam}
                  </Button>
                </Fragment>
              ))
            ) : (
              <span className="text-sm font-medium text-muted-foreground px-3 py-1 select-none">
                No cameras found
              </span>
            )}
          </ButtonGroup>

          {/* Ambilight toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 rounded-lg transition-all", showAmbilight ? "text-primary bg-primary/10" : "text-muted-foreground")}
            onClick={() => setShowAmbilight(v => !v)}
            title={showAmbilight ? "Disable ambilight" : "Enable ambilight"}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </Button>

          {/* Gamification Filter */}
          <div className="w-[180px]">
            <Select
              value={analysisGamificationFilter}
              onValueChange={setAnalysisGamificationFilter}
            >
              <SelectTrigger className="h-8 bg-surface-2/50 border border-border text-sm text-foreground rounded-lg px-2.5 hover:bg-surface-2/70 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Filter..." />
              </SelectTrigger>
              <SelectContent className="bg-surface-2 border-border text-foreground">
                <SelectItem value="none">
                  <span className="text-sm">None</span>
                </SelectItem>
                <SelectItem value="sunglasses1">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/sunglasses1.png"
                      className="w-5 h-5 object-contain"
                      alt="Thug Life"
                    />
                    <span className="text-sm">Thug Life</span>
                  </div>
                </SelectItem>
                <SelectItem value="sunglasses2">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/sunglasses2.png"
                      className="w-5 h-5 object-contain"
                      alt="Sunglasses 2"
                    />
                    <span className="text-sm">Sunglasses 2</span>
                  </div>
                </SelectItem>
                <SelectItem value="hat1">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/hat1.png"
                      className="w-5 h-5 object-contain"
                      alt="Top Hat"
                    />
                    <span className="text-sm">Top Hat</span>
                  </div>
                </SelectItem>
                <SelectItem value="hat2">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/hat2.png"
                      className="w-5 h-5 object-contain"
                      alt="Cap"
                    />
                    <span className="text-sm">Cap</span>
                  </div>
                </SelectItem>
                <SelectItem value="hat_santa">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/hat_santa.png"
                      className="w-5 h-5 object-contain"
                      alt="Santa Hat"
                    />
                    <span className="text-sm">Santa Hat</span>
                  </div>
                </SelectItem>
                <SelectItem value="ears_bear">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/ears_bear.png"
                      className="w-5 h-5 object-contain"
                      alt="Bear Ears"
                    />
                    <span className="text-sm">Bear Ears</span>
                  </div>
                </SelectItem>
                <SelectItem value="ears_cat">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/ears_cat.png"
                      className="w-5 h-5 object-contain"
                      alt="Cat Ears"
                    />
                    <span className="text-sm">Cat Ears</span>
                  </div>
                </SelectItem>
                <SelectItem value="ears_teady">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/ears_teady.png"
                      className="w-5 h-5 object-contain"
                      alt="Teddy Ears"
                    />
                    <span className="text-sm">Teddy Ears</span>
                  </div>
                </SelectItem>
                <SelectItem value="mus1">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/mus1.png"
                      className="w-5 h-5 object-contain"
                      alt="Mustache 1"
                    />
                    <span className="text-sm">Mustache 1</span>
                  </div>
                </SelectItem>
                <SelectItem value="mus2">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/mus2.png"
                      className="w-5 h-5 object-contain"
                      alt="Mustache 2"
                    />
                    <span className="text-sm">Mustache 2</span>
                  </div>
                </SelectItem>
                <SelectItem value="mus3">
                  <div className="flex items-center gap-2">
                    <img
                      src="/api/analysis/assets/gamification/mus3.png"
                      className="w-5 h-5 object-contain"
                      alt="Mustache 3"
                    />
                    <span className="text-sm">Mustache 3</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analysisChronosRunning ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  className="rounded-full h-10 w-10 bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  <Square className="w-4 h-4 fill-current" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
                    <StopCircle className="w-6 h-6" />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Stop tracking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will stop the current tracking process and any progress
                    will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-500 hover:bg-red-600 text-white font-medium"
                    onClick={stopTracking}
                  >
                    Stop
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="default"
              size="icon"
              className="rounded-full h-10 w-10 shadow-lg shadow-primary/20 disabled:opacity-30"
              disabled={analysisCheckedFiles.length === 0}
              onClick={startTracking}
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="w-full flex-1 min-h-0 rounded-3xl bg-black border border-white/5 overflow-hidden relative group shadow-2xl shadow-black/50">
        {analysisChronosRunning ? (
          analysisChronosFrame ? (
            <>
              {/* Ambilight Effect — dominant-color radial glow (no decode, no blur filter) */}
              {showAmbilight && (
                <div
                  className="absolute inset-0 pointer-events-none transition-all duration-700"
                  style={{
                    background: `radial-gradient(ellipse at center, rgba(${ambilightColor},0.45) 0%, rgba(${ambilightColor},0.15) 50%, transparent 80%)`,
                  }}
                />
              )}
              <img
                src={`data:image/jpeg;base64,${analysisChronosFrame}`}
                className="w-full h-full object-contain relative z-10"
                alt="Tracking preview"
              />
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-12 animate-pulse">
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Video className="w-8 h-8 text-primary/60" />
              </div>
              <p className="text-xs text-primary/60 tracking-widest font-medium text-center uppercase">
                Initializing Stream...
              </p>
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-12 bg-[#050505] select-none">
            {/* Ambient glow circle */}
            <div className="absolute w-[220px] h-[220px] rounded-full bg-white/[0.03] blur-[50px] pointer-events-none" />
            
            <div className="w-20 h-20 rounded-full border border-white/5 flex items-center justify-center animate-pulse-sync">
              <Square className="w-8 h-8 fill-current stroke-[1.2]" />
            </div>
            <div className="text-center space-y-1.5 animate-pulse-sync">
              <p className="text-sm tracking-[0.2em] font-extrabold uppercase">
                System Halted
              </p>
              <p className="text-xs uppercase tracking-wider opacity-60 font-mono">
                Select cases and press play to start tracking
              </p>
            </div>
          </div>
        )}

        {/* HUD Overlay - Status & Progress (Upper Center) */}
        {analysisChronosRunning && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 animate-in zoom-in duration-300">
            <Badge
              className="px-4 py-1.5 text-xs font-bold tracking-widest border border-white/10 bg-black/60 backdrop-blur-md text-foreground transition-all duration-500 whitespace-nowrap flex items-center gap-2 shadow-xl shadow-black/40"
            >
              <Spinner className="w-3 h-3 border-foreground/30 border-t-foreground" />
              <span>
                {stats.engine || "ENGINE ACTIVE"} - {Math.round(analysisChronosProgress)}%
              </span>
              <span className="opacity-60 text-[10px] ml-1">
                ({(stats.task_idx ?? 0) + 1}/
                {stats.total_tasks || analysisCheckedFiles.length})
              </span>
            </Badge>
          </div>
        )}

        {/* HUD Overlay - Bottom Centered Group (H, V, FPS) */}
        {analysisChronosRunning && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20 animate-in zoom-in duration-300">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <MoveHorizontal className="w-3 h-3 text-orange-500" />
            <span className="text-xs font-bold text-orange-500 tracking-tighter">
              h: {stats.h_val?.toFixed(2)}
            </span>
          </div>
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <MoveVertical className="w-3 h-3 text-blue-500" />
            <span className="text-xs font-bold text-blue-500 tracking-tighter">
              v: {stats.v_val?.toFixed(2)}
            </span>
          </div>
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <CircleGauge className="w-3.5 h-3.5 text-[#2da44e]" />
            <span className="text-xs font-bold text-[#2da44e] tracking-tighter">
              {Math.round(stats.fps)} FPS
            </span>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
