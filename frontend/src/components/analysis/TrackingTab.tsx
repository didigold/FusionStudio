import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Video, Activity, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from '@/store/useAppStore';
import { analysisApi } from '@/api/analysisApi';

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
    addLog
  } = useAppStore();

  const [frameData] = useState<string | null>(null);

  const availableCameras = analysisAvailableCameras;

  const toggleTracking = async () => {
    if (analysisChronosRunning) {
      try {
        await analysisApi.stopChronos();
        setAnalysisChronosRunning(false);
      } catch {
        addLog('Failed to stop tracking');
      }
    } else {
      try {
        const res = await analysisApi.runChronos(
          analysisCheckedFiles,
          analysisSelectedCamera,
          analysisSourcePath
        );
        if (res.data.status === 'started') {
          setAnalysisChronosRunning(true);
          addLog(`Chronos started: ${res.data.task_count} task(s)`);
        } else if (res.data.status === 'no_tasks') {
          addLog('No tasks could be resolved from the selected files');
        } else if (res.data.status === 'already_running') {
          addLog('Tracking is already running');
        }
      } catch {
        addLog('Failed to start tracking');
      }
    }
  };

  const stats = analysisChronosStats || {
    h_val: 0,
    v_val: 0,
    fps: 0,
    frame: 0,
    total_frames: 0
  };

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500 h-full">
      {/* Header Bar */}
      <div className="flex items-center justify-between p-2 rounded-2xl bg-surface-2 border border-white/5">
        <div className="flex items-center gap-3 ml-2">
          <Badge className={cn("px-3 py-1 text-[10px] font-bold tracking-wider border-0 transition-colors duration-500", 
            analysisChronosRunning ? "bg-[#2da44e] text-white shadow-[0_0_15px_rgba(45,164,78,0.3)]" : "bg-surface-3 text-muted-foreground")}>
            engine {analysisChronosRunning ? 'active' : 'idle'}
          </Badge>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-foreground uppercase tracking-tight truncate max-w-[200px]">
              {analysisCheckedFiles.length} files selected
            </span>
            <span className="text-[9px] text-muted-foreground tracking-tight">
              {stats.frame} / {stats.total_frames} frames
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pr-1">
          <div className="flex items-center bg-surface-3/50 rounded-xl border border-white/5 p-1 gap-1">
            {availableCameras.length > 0 ? (
              availableCameras.map(cam => (
                <Button 
                  key={cam}
                  variant={analysisSelectedCamera === cam ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 px-3 rounded-lg text-[10px] font-bold transition-all",
                    analysisSelectedCamera === cam ? "bg-primary text-black" : "text-muted-foreground hover:bg-surface-2"
                  )}
                  onClick={() => setAnalysisSelectedCamera(cam)}
                >
                  cam{cam}
                </Button>
              ))
            ) : (
              <span className="text-[10px] font-bold text-muted-foreground px-3 py-1">no cams found</span>
            )}
          </div>
          <Button 
            onClick={toggleTracking}
            disabled={analysisCheckedFiles.length === 0}
            className={cn("h-10 px-6 rounded-xl font-bold tracking-widest transition-all duration-300",
              analysisChronosRunning 
                ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20" 
                : "bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20"
            )}
          >
            {analysisChronosRunning ? (
              <><Square className="w-4 h-4 mr-2 fill-current" /> stop</>
            ) : (
              <><Play className="w-4 h-4 mr-2 fill-current" /> start</>
            )}
          </Button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="flex-1 min-h-[300px] rounded-3xl bg-black border border-white/5 overflow-hidden relative group">
        {frameData ? (
          <img src={`data:image/jpeg;base64,${frameData}`} className="w-full h-full object-contain" alt="Tracking preview" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-12">
            <div className="w-20 h-20 rounded-full bg-surface-2 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <Video className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground/60 tracking-widest font-medium text-center">Waiting for video stream...</p>
          </div>
        )}

        {/* HUD Overlay */}
        <div className="absolute top-6 left-6 flex flex-col gap-2">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-[10px] font-bold text-orange-500 tracking-tighter">h: {stats.h_val?.toFixed(2)}</span>
          </div>
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold text-blue-500 tracking-tighter">v: {stats.v_val?.toFixed(2)}</span>
          </div>
        </div>

        <div className="absolute bottom-6 right-6">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
            <Activity className="w-3.5 h-3.5 text-[#2da44e]" />
            <span className="text-xs font-bold text-white tracking-widest">{stats.fps} fps</span>
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <Card className="bg-surface-2 border-white/5 shadow-xl">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-muted-foreground tracking-widest">processing progress</span>
                <span className="text-xs font-bold text-primary">{Math.round(analysisChronosProgress)}%</span>
              </div>
              <Progress value={analysisChronosProgress} className="h-2 bg-surface-3" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
