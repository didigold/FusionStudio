import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Minus, Plus, Activity, Mic, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from '@/store/useAppStore';

interface AudioTabProps {
  selectedFile: string | null;
}

export function AudioTab({ selectedFile }: AudioTabProps) {
  const { analysisCheckedFiles, addLog } = useAppStore();
  const [minFreq, setMinFreq] = useState(230);
  const [maxFreq, setMaxFreq] = useState(2000);
  const [threshold, setThreshold] = useState(0.5);
  const [isDetecting, setIsDetecting] = useState(false);
  const [peakFreq, setPeakFreq] = useState<number | null>(null);

  const fileToUse = selectedFile || analysisCheckedFiles[0] || null;

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
        const newMin = Math.max(0, Math.round(freq - 15));
        const newMax = Math.round(freq + 15);
        setMinFreq(newMin);
        setMaxFreq(newMax);
        toast("Peak frequency detected", {
          description: `${freq.toFixed(1)} Hz · auto-set range to ${newMin}–${newMax} Hz`,
        });
        addLog(`Audio autodetect: ${freq.toFixed(1)} Hz (range ${newMin}-${newMax} Hz)`);
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
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Audio Analysis</h3>
              <p className="text-sm text-muted-foreground tracking-tight">Frequency & Peak Detection</p>
            </div>
          </div>
          {fileToUse && (
            <Badge variant="outline" className="text-sm tracking-tight bg-surface-3 ml-4 truncate max-w-[180px]">
              {fileToUse.split(/[\\/]/).pop()}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-6 rounded-xl bg-surface-2 border border-white/5 p-4">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">Minimum frequency</span>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0"
                onClick={() => setMinFreq(Math.max(1, minFreq - 10))}
                disabled={minFreq <= 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-4xl font-bold tracking-tighter tabular-nums w-24 text-center">{minFreq}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0"
                onClick={() => setMinFreq(Math.min(maxFreq - 1, minFreq + 10))}
                disabled={minFreq >= maxFreq - 1}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-sm text-muted-foreground text-center">Hz</span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-sm font-medium text-foreground">Maximum frequency</span>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0"
                onClick={() => setMaxFreq(Math.max(minFreq + 1, maxFreq - 10))}
                disabled={maxFreq <= minFreq + 1}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="text-4xl font-bold tracking-tighter tabular-nums w-24 text-center">{maxFreq}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full shrink-0"
                onClick={() => setMaxFreq(Math.min(24000, maxFreq + 10))}
                disabled={maxFreq >= 24000}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <span className="text-sm text-muted-foreground text-center">Hz</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-surface-2 border border-white/5 p-4">
          <span className="text-sm font-medium text-foreground">Threshold</span>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={() => setThreshold(Math.max(0.01, Number((threshold - 0.01).toFixed(2))))}
              disabled={threshold <= 0.01}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-4xl font-bold tracking-tighter tabular-nums w-24 text-center">{threshold.toFixed(2)}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={() => setThreshold(Number((threshold + 0.01).toFixed(2)))}
              disabled={threshold >= 5}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground text-center">Sensitivity for peak detection. Lower values detect more peaks.</span>
        </div>

        <Button
          onClick={handleAutodetect}
          disabled={isDetecting}
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