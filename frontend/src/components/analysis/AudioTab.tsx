import { useState, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, Activity, Mic, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import DotField from './DotField';
import SpotlightCard from './SpotlightCard';
import Counter from './Counter';

function EditableCounter({ 
  value, 
  onChange, 
  min, 
  max, 
  isDecimal = false 
}: { 
  value: number, 
  onChange: (v: number) => void, 
  min: number, 
  max: number, 
  isDecimal?: boolean 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());

  const handleBlur = () => {
    setIsEditing(false);
    let parsed = parseFloat(tempValue);
    if (isNaN(parsed)) {
      parsed = value;
    }
    parsed = Math.max(min, Math.min(max, parsed));
    onChange(isDecimal ? Number(parsed.toFixed(3)) : Math.round(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  if (isEditing) {
    return (
      <input
        type="number"
        value={tempValue}
        placeholder={isDecimal ? "0.000" : "0"}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        step={isDecimal ? 0.001 : 1}
        className="w-24 h-12 text-center bg-transparent text-foreground border-b border-white/20 font-bold tracking-tighter tabular-nums focus:outline-none focus:border-primary"
        style={{ fontSize: 36, appearance: 'textfield' }}
      />
    );
  }

  return (
    <div 
      className="w-24 h-12 flex items-center justify-center cursor-text hover:bg-white/5 rounded-lg transition-colors overflow-visible font-bold" 
      onClick={() => { setTempValue(value.toFixed(isDecimal ? 3 : 0)); setIsEditing(true); }}
    >
      <Counter
        value={value}
        fontSize={36}
        padding={0}
        gap={1}
        textColor="currentColor"
        fontWeight={800}
        gradientFrom="transparent"
        gradientTo="transparent"
        places={isDecimal ? [1, ".", 0.1, 0.01, 0.001] : undefined}
      />
    </div>
  );
}

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
  const { isDark } = useTheme();
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
  const thresholdMinusHandlers = useHoldRepeat(() => setThreshold(t => Math.max(0.001, Number((t - 0.001).toFixed(3)))));
  const thresholdPlusHandlers = useHoldRepeat(() => setThreshold(t => Math.min(5, Number((t + 0.001).toFixed(3)))));

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
          min_freq: 230,
          max_freq: 2000,
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
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <DotField
            dotRadius={1.5}
            dotSpacing={14}
            bulgeStrength={67}
            glowRadius={160}
            sparkle={false}
            waveAmplitude={0}
            cursorRadius={500}
            cursorForce={0.1}
            bulgeOnly
            darkGradientFrom="rgba(255, 255, 255, 0.75)"
            darkGradientTo="rgba(255, 255, 255, 0.45)"
            lightGradientFrom="rgba(80, 80, 80, 0.6)"
            lightGradientTo="rgba(100, 100, 100, 0.4)"
            glowColor="transparent"
          />
        </div>
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
        <SpotlightCard 
          className="flex flex-col gap-6 rounded-3xl bg-surface-2/20 border border-white/5 p-6 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300"
          spotlightColor={isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"}
        >
          
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
              <EditableCounter value={minFreq} onChange={setMinFreq} min={1} max={maxFreq - 1} />
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
              <EditableCounter value={maxFreq} onChange={setMaxFreq} min={minFreq + 1} max={24000} />
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
                disabled={threshold <= 0.001}
                {...thresholdMinusHandlers}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <EditableCounter value={threshold} onChange={setThreshold} min={0.001} max={5} isDecimal />
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0 border-white/5 bg-surface-3/30"
                disabled={threshold >= 5}
                {...thresholdPlusHandlers}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground text-center tracking-tight leading-normal">
              Sensitivity for peak detection. Lower values detect more peaks.
            </span>
          </div>
        </SpotlightCard>

        <Button
          onClick={handleAutodetect}
          disabled={isDetecting || !fileToUse}
          className="w-full h-10 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-lg shadow-primary/20 disabled:opacity-100 disabled:bg-surface-3 disabled:text-muted-foreground/60"
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
