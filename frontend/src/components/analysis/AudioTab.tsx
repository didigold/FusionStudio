import { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, Activity, Mic, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from '@/store/useAppStore';

// Custom hook for hold-to-repeat behavior with acceleration
function useHoldRepeat(callback: () => void, delay = 400) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRolled = useRef(false);
  const countRef = useRef(0);

  const clear = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    hasRolled.current = false;
    countRef.current = 0;
  }, []);

  const tick = useCallback(() => {
    callbackRef.current();
    countRef.current += 1;
    // Accelerate: start at 250ms, reduce by 15ms each tick, floor at 30ms
    const nextDelay = Math.max(30, 250 - countRef.current * 15);
    timeoutRef.current = setTimeout(tick, nextDelay);
  }, []);

  const onMouseDown = useCallback(() => {
    hasRolled.current = false;
    countRef.current = 0;
    timeoutRef.current = setTimeout(() => {
      hasRolled.current = true;
      callbackRef.current();
      countRef.current = 1;
      timeoutRef.current = setTimeout(tick, 235); // 250 - 15
    }, delay);
  }, [delay, tick]);

  const onMouseUp = useCallback(() => {
    if (!hasRolled.current && timeoutRef.current) {
      callbackRef.current(); // Single click behavior
    }
    clear();
  }, [clear]);

  const onMouseLeave = useCallback(() => {
    clear();
  }, [clear]);

  return { onMouseDown, onMouseUp, onMouseLeave };
}

interface AudioTabProps {
  selectedFile: string | null;
}

export function AudioTab({ selectedFile }: AudioTabProps) {
  const { 
    analysisCheckedFiles, 
    addLog,
    audioMinFreq: minFreq,
    setAudioMinFreq: setMinFreq,
    audioMaxFreq: maxFreq,
    setAudioMaxFreq: setMaxFreq,
    audioThreshold: threshold,
    setAudioThreshold: setThreshold
  } = useAppStore();
  const [isDetecting, setIsDetecting] = useState(false);
  const [peakFreq, setPeakFreq] = useState<number | null>(null);

  const fileToUse = selectedFile || analysisCheckedFiles[0] || null;

  // Refs to avoid stale closures in hold-repeat callbacks
  const minFreqRef = useRef(minFreq);
  const maxFreqRef = useRef(maxFreq);
  minFreqRef.current = minFreq;
  maxFreqRef.current = maxFreq;

  // Hooks must be called at top level
  const minMinusHandlers = useHoldRepeat(() => setMinFreq(f => Math.max(1, f - 1)));
  const minPlusHandlers = useHoldRepeat(() => setMinFreq(f => Math.min(maxFreqRef.current - 1, f + 1)));
  const maxMinusHandlers = useHoldRepeat(() => setMaxFreq(f => Math.max(minFreqRef.current + 1, f - 1)));
  const maxPlusHandlers = useHoldRepeat(() => setMaxFreq(f => Math.min(24000, f + 1)));

  const handleAutodetect = async () => {
    if (!fileToUse) {
      toast("No file selected", {
        description: "Please check a recording in the panel to the left first.",
      });
      return;
    }
    setIsDetecting(true);
    try {
      const response = await fetch('http://localhost:8001/api/analysis/detect/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: fileToUse,
          min_freq: minFreq,
          max_freq: maxFreq,
          signal_name: "SoundPressure"
        })
      });
      const data = await response.json();
      if (data.success) {
        const freq = data.peak_frequency;
        setPeakFreq(freq);
        
        // Update frequency ranges to be +/- 15 Hz around detected frequency
        const roundedFreq = Math.round(freq);
        setMinFreq(Math.max(1, roundedFreq - 15));
        setMaxFreq(Math.min(24000, roundedFreq + 15));

        toast("Peak frequency detected", {
          description: `${freq.toFixed(1)} Hz`,
        });
        addLog(`Audio autodetect: ${freq.toFixed(1)} Hz`);
      } else {
        toast("Detection failed", {
          description: data.error || "Unknown error",
        });
      }
    } catch {
      toast("Detection error", {
        description: "Could not connect to the analysis service.",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center h-full min-h-0 overflow-y-auto p-8 bg-background">
      
      {/* Background Grid & Animation Layer */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {/* Pulsing Grid Backdrop - centered to align coordinates mathematically */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none" 
          style={{ 
            maskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 70%, transparent 100%)', 
            WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 70%, transparent 100%)' 
          }}
        >
          {/* Base faint grid — pure CSS */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
          {/* Pulsing brighter grid */}
          <div
            className="absolute inset-0 pointer-events-none animate-pulse-sync opacity-80"
            style={{
              backgroundImage: `linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)`,
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Soft orange glowing core — pure CSS breathing animation */}
        <style>{`
          @keyframes audioBreathe {
            0%, 100% { transform: scale(0.9); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 1.0; }
          }
          .audio-breathe { animation: audioBreathe 4s ease-in-out infinite; }
        `}</style>
        <div
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none audio-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(249, 115, 22, 0.05) 0%, rgba(249, 115, 22, 0) 70%)'
          }}
        />
      </div>

      <div className="w-full max-w-sm space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Header Icon Container with backdrop-blur for grid masking consistency */}
            <div className="w-8 h-8 rounded-lg bg-surface-2/40 border border-white/5 backdrop-blur-md flex items-center justify-center shadow-md">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Audio Analysis</h3>
              <p className="text-sm text-muted-foreground tracking-tight">Frequency & Peak Detection</p>
            </div>
          </div>
          <Badge variant="outline" className={`text-sm tracking-tight bg-surface-3 ml-4 truncate max-w-[180px] ${!fileToUse ? 'text-muted-foreground border-white/5' : ''}`}>
            {fileToUse ? fileToUse.split(/[\\/]/).pop() : "No recording active"}
          </Badge>
        </div>

        {/* Glassmorphic blur frame container */}
        <div className="flex flex-col gap-6 rounded-3xl bg-surface-2/20 border border-white/5 p-6 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300">
          
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">Minimum frequency</span>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 border-white/5 bg-surface-3/30"
                disabled={minFreq <= 1}
                {...minMinusHandlers}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-4xl font-bold tracking-tighter tabular-nums w-24 text-center">{minFreq}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 border-white/5 bg-surface-3/30"
                disabled={minFreq >= maxFreq - 1}
                {...minPlusHandlers}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground text-center tracking-tight">Hz</span>
          </div>

          <div className="h-[1px] bg-white/5" />

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">Maximum frequency</span>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 border-white/5 bg-surface-3/30"
                disabled={maxFreq <= minFreq + 1}
                {...maxMinusHandlers}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-4xl font-bold tracking-tighter tabular-nums w-24 text-center">{maxFreq}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 border-white/5 bg-surface-3/30"
                disabled={maxFreq >= 24000}
                {...maxPlusHandlers}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground text-center tracking-tight">Hz</span>
          </div>

          <div className="h-[1px] bg-white/5" />

          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">Threshold</span>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 border-white/5 bg-surface-3/30"
                onClick={() => setThreshold(Math.max(0.01, Number((threshold - 0.01).toFixed(2))))}
                disabled={threshold <= 0.01}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-4xl font-bold tracking-tighter tabular-nums w-24 text-center">{threshold.toFixed(2)}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 border-white/5 bg-surface-3/30"
                onClick={() => setThreshold(Number((threshold + 0.01).toFixed(2)))}
                disabled={threshold >= 5}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground text-center tracking-tight leading-normal">
              Sensitivity for peak detection. Lower values detect more peaks.
            </span>
          </div>
        </div>

        <Button
          onClick={handleAutodetect}
          disabled={isDetecting || !fileToUse}
          className="w-full h-10 text-sm font-medium bg-primary text-black hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20"
        >
          {isDetecting ? (
            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Activity className="w-4 h-4 mr-2" />
          )}
          {isDetecting ? "Detecting..." : "Autodetect"}
        </Button>

        {peakFreq !== null && (
          <Card className="bg-[#2da44e]/5 border-[#2da44e]/20 animate-in slide-in-from-bottom-2 duration-300">
            <CardContent className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#2da44e]/20 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#2da44e]" />
                </div>
                <span className="text-sm font-medium text-[#2da44e]">Peak Frequency Detected</span>
              </div>
              <div className="text-lg font-black text-[#2da44e] tracking-tighter">
                {peakFreq.toFixed(1)} <span className="text-sm opacity-60 ml-0.5">Hz</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
