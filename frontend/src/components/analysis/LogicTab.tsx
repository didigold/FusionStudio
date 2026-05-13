import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  GitBranch, 
  Save, 
  Download, 
  Settings, 
  PlayCircle, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

const NCAP_CATEGORIES = [
  "Long Distraction (NDT)",
  "Long Distraction (DT)",
  "Short Distraction (NDT)",
  "Short Distraction (DT)",
  "Microsleep",
  "Sleep",
  "Drowsiness",
  "Unresponsive driver"
];

export function LogicTab() {
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Analysis Logic</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Protocol Configuration</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase font-black tracking-widest border-white/10 bg-surface-2">
            <Download className="w-3 h-3 mr-2" /> Import
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase font-black tracking-widest border-white/10 bg-surface-2 text-primary">
            <Save className="w-3 h-3 mr-2" /> Save Config
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card className="bg-surface-2 border-white/5 shadow-2xl overflow-hidden">
          <CardHeader className="pb-2 border-b border-white/5 bg-surface-3/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Settings className="w-3 h-3" /> Category Rules
              </CardTitle>
              <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-primary">
                Edit Global Gauges <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-surface-3/50">
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-[9px] uppercase font-black h-8">Distraction Category</TableHead>
                  <TableHead className="text-[9px] uppercase font-black h-8 text-center">Min (s)</TableHead>
                  <TableHead className="text-[9px] uppercase font-black h-8 text-center">Max (s)</TableHead>
                  <TableHead className="text-[9px] uppercase font-black h-8 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {NCAP_CATEGORIES.map((cat, i) => (
                  <TableRow key={cat} className="border-white/5 hover:bg-white/5 transition-colors group">
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40 group-hover:bg-blue-500 transition-colors" />
                        <span className="text-xs font-medium">{cat}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 text-center">
                      <Input defaultValue="2.0" className="h-7 w-16 mx-auto bg-surface-3 border-white/5 text-[10px] text-center" />
                    </TableCell>
                    <TableCell className="py-2.5 text-center">
                      <Input defaultValue="10.0" className="h-7 w-16 mx-auto bg-surface-3 border-white/5 text-[10px] text-center" />
                    </TableCell>
                    <TableCell className="py-2.5 text-right">
                      <Badge variant="outline" className="text-[8px] uppercase tracking-tighter border-white/5 bg-white/5">
                        {i % 3 === 0 ? 'Verified' : 'Pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Card className="flex-1 bg-surface-2 border-white/5 shadow-xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#2da44e]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-[#2da44e]" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-tight">Auto-Load Project</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Sync MF4 folders</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 border-white/10 hover:bg-surface-3">
                Start Sync
              </Button>
            </CardContent>
          </Card>

          <Button 
            onClick={() => setIsGenerating(!isGenerating)}
            className={cn("flex-[0.6] h-auto rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300",
              isGenerating 
                ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                : "bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20"
            )}
          >
            {isGenerating ? (
              <><AlertCircle className="w-4 h-4 mr-2" /> Stop Generation</>
            ) : (
              <><PlayCircle className="w-4 h-4 mr-2" /> Generate Reports</>
            )}
          </Button>
        </div>

        {isGenerating && (
          <Card className="bg-primary/5 border-primary/20 border-dashed animate-pulse">
            <CardContent className="py-3 flex items-center gap-3">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold uppercase text-primary tracking-widest">Generating global PDF report bundle...</span>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
