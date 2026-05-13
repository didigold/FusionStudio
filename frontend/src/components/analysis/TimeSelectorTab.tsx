import { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { 
  LineChart, 
  ChevronLeft, 
  ChevronRight, 
  Focus, 
  Undo2, 
  Trash2, 
  Play, 
  Pause, 
  Lock, 
  Unlock,
  Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";

export function TimeSelectorTab() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSynced, setIsSynced] = useState(true);
  const [time, setTime] = useState(0);

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500 h-full">
      {/* Top Controls */}
      <div className="grid grid-cols-4 gap-3 bg-surface-2 p-3 rounded-2xl border border-white/5">
        <div className="space-y-1.5">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1">Top Signal</Label>
          <Select defaultValue="SoundPressure">
            <SelectTrigger className="h-8 bg-surface-3 border-white/5 rounded-lg text-[11px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-3 border-white/5 text-xs">
              <SelectItem value="SoundPressure">SoundPressure</SelectItem>
              <SelectItem value="Gaze_X">Gaze_X</SelectItem>
              <SelectItem value="Gaze_Y">Gaze_Y</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1">Bottom Signal</Label>
          <Select defaultValue="Gaze_X">
            <SelectTrigger className="h-8 bg-surface-3 border-white/5 rounded-lg text-[11px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-3 border-white/5 text-xs">
              <SelectItem value="SoundPressure">SoundPressure</SelectItem>
              <SelectItem value="Gaze_X">Gaze_X</SelectItem>
              <SelectItem value="Gaze_Y">Gaze_Y</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[9px] uppercase text-muted-foreground ml-1">Subject</Label>
          <Select defaultValue="P1">
            <SelectTrigger className="h-8 bg-surface-3 border-white/5 rounded-lg text-[11px] font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-3 border-white/5 text-xs">
              <SelectItem value="P1">P1</SelectItem>
              <SelectItem value="P2">P2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-white/10 hover:bg-surface-3">
            <Focus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-white/10 hover:bg-surface-3 text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-white/10 hover:bg-surface-3">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Graph Area Placeholder */}
      <div className="flex-1 min-h-[250px] bg-black/40 rounded-3xl border border-white/5 relative flex flex-col gap-2 p-4">
        <div className="flex-1 bg-surface-2/30 rounded-xl border border-white/5 flex items-center justify-center">
          <div className="flex flex-col items-center opacity-20">
            <LineChart className="w-12 h-12 mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Top Signal Graph</span>
          </div>
        </div>
        <div className="flex-1 bg-surface-2/30 rounded-xl border border-white/5 flex items-center justify-center">
          <div className="flex flex-col items-center opacity-20">
            <LineChart className="w-12 h-12 mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Bottom Signal Graph</span>
          </div>
        </div>
      </div>

      {/* Filmstrip & Timeline */}
      <div className="bg-surface-2 p-4 rounded-3xl border border-white/5 space-y-4">
        <div className="h-12 bg-black rounded-xl border border-white/5 flex items-center gap-1 overflow-hidden px-1">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-10 aspect-video bg-surface-3 rounded-md border border-white/5 flex-shrink-0 animate-pulse" />
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              variant="outline" 
              onClick={() => setIsPlaying(!isPlaying)}
              className="h-10 w-10 rounded-xl border-white/10 bg-surface-3 hover:bg-surface-3/80"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              onClick={() => setIsSynced(!isSynced)}
              className={cn("h-10 w-10 rounded-xl border-white/10 transition-colors", isSynced ? "bg-primary text-black" : "bg-surface-3")}
            >
              {isSynced ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex-1 flex flex-col gap-1">
            <Slider value={[time]} onValueChange={([v]) => setTime(v)} max={100} step={0.1} />
            <div className="flex justify-between px-1">
              <span className="text-[9px] font-bold text-muted-foreground uppercase">0.00s</span>
              <span className="text-[9px] font-bold text-primary uppercase">Current: {(time * 2.5).toFixed(2)}s</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase">250.00s</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Select defaultValue="1x">
              <SelectTrigger className="h-10 w-20 bg-surface-3 border-white/10 rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface-3 border-white/10 text-xs">
                <SelectItem value="0.5x">0.5x</SelectItem>
                <SelectItem value="1x">1x</SelectItem>
                <SelectItem value="2x">2x</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-white/10 bg-surface-3">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" className="flex-1 h-12 rounded-2xl border-white/5 bg-surface-2 hover:bg-surface-3 text-xs font-bold uppercase tracking-widest">
          <ChevronLeft className="w-4 h-4 mr-2" /> Previous Case
        </Button>
        <Button variant="outline" className="flex-1 h-12 rounded-2xl border-white/5 bg-surface-2 hover:bg-surface-3 text-xs font-bold uppercase tracking-widest text-primary">
          Next Case <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
