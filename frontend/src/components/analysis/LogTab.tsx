import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LogMessage {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export function LogTab() {
  const logs: LogMessage[] = [
    { timestamp: '18:41:02', level: 'info', message: 'Analysis module initialized.' },
    { timestamp: '18:41:05', level: 'info', message: 'Scanning source directory: C:/Users/didac/Desktop/FusionStudio/Data' },
    { timestamp: '18:41:08', level: 'info', message: 'Found 12 participants and 48 MF4 files.' },
    { timestamp: '18:41:10', level: 'warn', message: 'Missing marks.json in participant D02. Skipping status sync.' },
    { timestamp: '18:41:15', level: 'debug', message: 'Vite HMR connection established.' },
  ];

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [logs]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface-2/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">System Console</h3>
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Real-time Backend Streams</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Filter logs..." 
              className="h-9 w-48 pl-8 text-xs bg-surface-3 border-white/5 rounded-xl focus-visible:ring-primary/20"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/5 bg-surface-3 hover:bg-surface-3/80">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-white/5 bg-surface-3 hover:bg-surface-3/80 text-red-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed bg-[#0a0a0a] selection:bg-primary/20">
        <div className="space-y-1">
          {logs.map((log, i) => (
            <div key={i} className="flex gap-4 group hover:bg-white/5 rounded px-2 py-0.5 transition-colors">
              <span className="text-muted-foreground/40 select-none shrink-0">{log.timestamp}</span>
              <span className={cn("font-black uppercase tracking-tighter shrink-0 w-12 text-center", {
                "text-blue-400": log.level === 'info',
                "text-orange-400": log.level === 'warn',
                "text-red-500": log.level === 'error',
                "text-purple-400": log.level === 'debug',
              })}>
                {log.level}
              </span>
              <span className="text-white/80 group-hover:text-white transition-colors">{log.message}</span>
            </div>
          ))}
          <div />
        </div>
      </div>

      <div className="p-3 bg-surface-2 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#2da44e] animate-pulse" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Backend Connected</span>
          </div>
          <div className="h-4 w-px bg-white/5" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Listening on port 8001</span>
        </div>
        <div className="flex items-center gap-2">
           <Badge variant="outline" className="text-[9px] uppercase tracking-tighter bg-white/5 border-0">UTF-8</Badge>
           <Badge variant="outline" className="text-[9px] uppercase tracking-tighter bg-white/5 border-0">LF</Badge>
        </div>
      </div>
    </div>
  );
}
