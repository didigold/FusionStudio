import { Fragment, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@/components/ui/button-group";
import { Play, Square, Video, Activity, StopCircle, CircleGauge } from "lucide-react";
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

export function TrackingTab() {
  const {
    analysisSourcePath,
    analysisAvailableCameras,
    analysisSelectedCamera,
    setAnalysisSelectedCamera,
    analysisCheckedFiles,
    analysisChronosRunning,
    setAnalysisChronosRunning,
    analysisChronosProgress,
    analysisChronosStats,
    analysisChronosFrame,
    addLog,
  } = useAppStore();

  const availableCameras = analysisAvailableCameras;

  const startTracking = useCallback(async () => {
    try {
      const res = await analysisApi.runChronos(
        analysisCheckedFiles,
        analysisSelectedCamera,
        analysisSourcePath,
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
      {/* Header */}
      <div className="flex items-center justify-between relative min-h-[48px]">
        <div className="flex items-center gap-3">
          <Badge
            className={cn(
              "px-3 py-1 text-sm font-bold tracking-wider border-0 transition-colors duration-500",
              analysisChronosRunning
                ? "bg-[#2da44e] text-white shadow-[0_0_15px_rgba(45,164,78,0.3)]"
                : "bg-surface-3 text-muted-foreground",
            )}
          >
            {analysisChronosRunning
              ? stats.engine || "engine active"
              : "engine idle"}
          </Badge>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
              {stats.file ||
                analysisCheckedFiles[0]?.split(/[\\/]/).pop() ||
                "No file selected"}
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.frame || 0} / {stats.total_frames || 0} frames
            </span>
          </div>
        </div>

        {/* Progress Center - FIXED POSITION */}
        {analysisChronosRunning && (
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none">
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/20 font-bold px-3 py-1 gap-2 animate-in zoom-in duration-300 pointer-events-auto shadow-lg shadow-primary/5"
            >
              <Spinner className="w-3 h-3" />
              <span className="text-xs uppercase tracking-tighter whitespace-nowrap">
                {Math.round(analysisChronosProgress)}% (
                {(stats.task_idx ?? 0) + 1}/
                {stats.total_tasks || analysisCheckedFiles.length})
              </span>
            </Badge>
          </div>
        )}

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
                        ? "bg-primary text-black"
                        : "text-muted-foreground hover:bg-surface-2",
                    )}
                    onClick={() => setAnalysisSelectedCamera(cam)}
                  >
                    cam{cam}
                  </Button>
                </Fragment>
              ))
            ) : (
              <span className="text-sm font-medium text-muted-foreground px-3 py-1">
                no cams found
              </span>
            )}
          </ButtonGroup>

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
              <AlertDialogContent size="sm">
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
                  <AlertDialogCancel variant="outline">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
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
      <div className="mx-auto w-full max-w-[1000px] h-[600px] rounded-3xl bg-black border border-white/5 overflow-hidden relative group shadow-2xl shadow-black/50">
        {analysisChronosRunning ? (
          analysisChronosFrame ? (
            <img
              src={`data:image/jpeg;base64,${analysisChronosFrame}`}
              className="w-full h-full object-contain"
              alt="Tracking preview"
            />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-12 bg-[#050505]">
            <div className="w-20 h-20 rounded-full bg-surface-2 border border-white/5 flex items-center justify-center opacity-50">
              <Square className="w-8 h-8 text-muted-foreground/20 fill-current" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground/40 tracking-widest font-bold uppercase">
                System Halted
              </p>
              <p className="text-[10px] text-muted-foreground/20 uppercase tracking-tighter">
                Select cases and press play to start tracking
              </p>
            </div>
          </div>
        )}

        {/* HUD Overlay - Bottom Centered Group */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-bold text-orange-500 tracking-tighter">
              h: {stats.h_val?.toFixed(2)}
            </span>
          </div>
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-500 tracking-tighter">
              v: {stats.v_val?.toFixed(2)}
            </span>
          </div>
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-1.5 flex items-center gap-3">
            <CircleGauge className="w-4 h-4 text-[#2da44e]" />
            <span className="text-xs font-bold text-white tracking-widest">
              {Math.round(stats.fps)} FPS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
