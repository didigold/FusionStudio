import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Activity, Volume2 } from "lucide-react";
import type { UnresponsivePhase } from '@/store/useAppStore';

interface UnresponsiveTimelineEditorProps {
  activeCategory: string;
  unresponsiveCriteria: Record<string, UnresponsivePhase[]>;
  setUnresponsiveCriteria: (uc: Record<string, UnresponsivePhase[]>) => void;
  availableSignals: string[];
  loadedFiles: Record<string, string>;
  signalValuesCache: Record<string, (number | string)[]>;
}

export function UnresponsiveTimelineEditor({
  activeCategory,
  unresponsiveCriteria,
  setUnresponsiveCriteria,
  availableSignals,
  loadedFiles,
  signalValuesCache
}: UnresponsiveTimelineEditorProps) {
  
  const phases = unresponsiveCriteria?.[activeCategory] || [];
  
  const isAudioSignal = (signalName: string) => {
    return signalName?.toLowerCase().includes('sound') || signalName?.toLowerCase().includes('audio') || signalName?.toLowerCase().includes('buzzer');
  };

  const updatePhaseField = (index: number, field: keyof UnresponsivePhase, value: any) => {
    const newCriteria = { ...(unresponsiveCriteria || {}) };
    const categoryPhases = [...(newCriteria[activeCategory] || [])];
    
    // When changing the signal, reset the other fields to sensible defaults
    if (field === 'signal') {
      const isNowAudio = isAudioSignal(value);
      categoryPhases[index] = {
        ...categoryPhases[index],
        signal: value,
        operator: isNowAudio ? undefined : '==',
        value: isNowAudio ? undefined : 0,
        frequency: isNowAudio ? 1000 : undefined,
        threshold: isNowAudio ? 0.5 : undefined,
      };
    } else {
      categoryPhases[index] = {
        ...categoryPhases[index],
        [field]: value
      };
    }

    newCriteria[activeCategory] = categoryPhases;
    setUnresponsiveCriteria(newCriteria);
  };

  const getTimelineArrows = (category: string) => {
    if (category.includes('DTR')) {
      return ["3-4s", "4s", "≤5s"];
    } else {
      // SLE: 2 phases only — Distinct Warning (≤7s) + Emergency Function (≤5s)
      return ["≤7s", "≤5s"];
    }
  };

  const getStartTriggerNode = (category: string) => {
    return category.includes('DTR') ? "Eyes off road" : "Eyes closed";
  };

  const arrows = getTimelineArrows(activeCategory);
  const startNode = getStartTriggerNode(activeCategory);

  // Helper to ensure 'SoundPressure' is always an option even if not in current file
  const signalOptions = useMemo(() => {
    const opts = new Set(availableSignals || []);
    opts.add('SoundPressure');
    return Array.from(opts).sort();
  }, [availableSignals]);

  return (
    <div className="bg-surface-2/50 backdrop-blur-md border-t border-border/50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest text-left">
          Unresponsive Driver Timeline
        </span>
      </div>

      <div className="flex flex-row items-center w-full overflow-x-auto pt-6 pb-2 gap-3 justify-start">
        {/* Starting Trigger Node (Visual Only) */}
        <div className="flex flex-col items-center justify-center w-[120px] shrink-0 h-20 bg-surface-3/50 rounded-xl border border-border/30 opacity-70">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center px-1">
            Initial Trigger
          </span>
          <span className="text-sm font-medium text-foreground mt-1">
            {startNode}
          </span>
        </div>

        {/* Render Phases */}
        {phases.map((phase, idx) => {
          const isAudio = isAudioSignal(phase.signal);
          const isEnabled = phase.enabled !== false;
          return (
            <React.Fragment key={idx}>
              <div className={`flex flex-col items-center justify-center px-1 shrink-0 transition-opacity duration-200 ${!isEnabled ? 'opacity-40' : ''}`}>
                <span className="text-sm font-semibold text-foreground mb-1 bg-surface-3 px-3.5 py-1 rounded-full border border-border/80 shadow-sm">
                  {arrows[idx] || "next"}
                </span>
                <ArrowRight className="text-muted-foreground/30 w-4 h-4" />
              </div>

              <div className={`flex flex-col gap-2 w-[240px] shrink-0 bg-surface-2/80 rounded-xl border border-border/50 p-4 shadow-sm relative group transition-all duration-200 ${
                !isEnabled ? 'opacity-40 bg-surface-2/30 border-border/20' : 'hover:border-primary/50'
              }`}>
                {/* Active/Enabled Toggle Checkbox */}
                <div className="absolute top-2.5 right-2.5 z-10 flex items-center">
                  <Checkbox
                    id={`phase-toggle-${idx}`}
                    checked={isEnabled}
                    onCheckedChange={(checked) => updatePhaseField(idx, "enabled", !!checked)}
                    className="h-4 w-4 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </div>

                <div className={`absolute -top-3 left-4 px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shadow-sm transition-colors duration-200 ${
                  !isEnabled
                    ? "bg-surface-3 text-muted-foreground border-border/30"
                    : isAudio
                    ? "bg-[#ebf3fe] text-blue-600 border-blue-500/30 dark:bg-blue-300 dark:text-blue-950 dark:border-blue-400/80"
                    : "bg-[#eafaf1] text-emerald-600 border-emerald-500/30 dark:bg-emerald-300 dark:text-emerald-950 dark:border-emerald-400/80"
                }`}>
                  {isAudio
                    ? <Volume2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-900" />
                    : <Activity className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-900" />
                  }
                  <span className="text-[11px] font-bold">
                    {phase.phaseName}
                  </span>
                </div>

                <div className="mt-1 flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-left">Signal</label>
                    <Select
                      disabled={!isEnabled}
                      value={phase.signal}
                      onValueChange={(val) => updatePhaseField(idx, "signal", val)}
                    >
                      <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20">
                        <SelectValue placeholder="Select signal" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs max-h-[200px]">
                        {signalOptions.map((name) => (
                          <SelectItem key={name} value={name} className="text-xs">
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isAudio ? (
                    <div className="flex gap-1.5">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-left">Min Hz</label>
                        <Input
                          disabled={!isEnabled}
                          type="number"
                          className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-1.5 font-mono"
                          value={phase.min_freq ?? phase.frequency ?? 800}
                          onChange={(e) => updatePhaseField(idx, "min_freq", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-left">Max Hz</label>
                        <Input
                          disabled={!isEnabled}
                          type="number"
                          className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-1.5 font-mono"
                          value={phase.max_freq ?? 2000}
                          onChange={(e) => updatePhaseField(idx, "max_freq", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-left">Thresh</label>
                        <Input
                          disabled={!isEnabled}
                          type="number"
                          step="0.1"
                          className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-1.5 font-mono"
                          value={phase.threshold ?? 0.5}
                          onChange={(e) => updatePhaseField(idx, "threshold", parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1 flex-[0.4]">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-left">Op</label>
                        <Select
                          disabled={!isEnabled}
                          value={phase.operator || ">"}
                          onValueChange={(val) => updatePhaseField(idx, "operator", val)}
                        >
                          <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20">
                            <SelectValue placeholder="Op" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs min-w-[50px]">
                            {['>', '<', '>=', '<=', '==', '!='].map(op => (
                              <SelectItem key={op} value={op} className="text-xs">{op}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-1 flex-[0.6]">
                        <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-left">Value</label>
                        {(() => {
                          const activeFile = loadedFiles?.[activeCategory] ?? "";
                          const cacheKey = `${activeFile}::${phase.signal}`;
                          const cachedVals = signalValuesCache?.[cacheKey] || [];
                          if (cachedVals && cachedVals.length > 0) {
                            const cleanCached = cachedVals.filter(
                              (v) =>
                                v !== null &&
                                v !== undefined &&
                                String(v).trim() !== "",
                            );
                            const currentVal = phase.value ?? 0;

                            const uniqueMap = new Map<string, number | string>();
                            uniqueMap.set(String(currentVal), currentVal);
                            cleanCached.forEach((v) => {
                              uniqueMap.set(String(v), v);
                            });

                            const allVals = Array.from(uniqueMap.values());
                            allVals.sort((a, b) => {
                              const numA = Number(a);
                              const numB = Number(b);
                              if (!isNaN(numA) && !isNaN(numB)) {
                                return numA - numB;
                              }
                              return String(a).localeCompare(String(b));
                            });

                            return (
                              <Select
                                disabled={!isEnabled}
                                value={String(currentVal)}
                                onValueChange={(val) => {
                                  const parsed = parseFloat(val);
                                  const finalVal = isNaN(parsed) ? val : parsed;
                                  updatePhaseField(idx, "value", finalVal);
                                }}
                              >
                                <SelectTrigger className="h-8 bg-surface-3/50 border border-border text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20 max-w-full">
                                  {(() => {
                                    // Compute common prefix for display-only label shortening
                                    const strVals = allVals.map((v) => String(v));
                                    const pfxLen = strVals.length > 1
                                      ? (() => {
                                          let len = 0;
                                          const first = strVals[0];
                                          for (let ci = 0; ci < first.length; ci++) {
                                            if (strVals.every((s) => s[ci] === first[ci])) len = ci + 1;
                                            else break;
                                          }
                                          return len > 2 ? len : 0;
                                        })()
                                      : 0;
                                    const display = pfxLen > 0
                                      ? String(currentVal).slice(pfxLen).trimStart()
                                      : String(currentVal);
                                    return <SelectValue>{display || String(currentVal)}</SelectValue>;
                                  })()}
                                </SelectTrigger>
                                <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs max-h-48 overflow-y-auto">
                                  {(() => {
                                    const strVals2 = allVals.map((v) => String(v));
                                    const pfxLen2 = strVals2.length > 1
                                      ? (() => {
                                          let len = 0;
                                          const first = strVals2[0];
                                          for (let ci = 0; ci < first.length; ci++) {
                                            if (strVals2.every((s) => s[ci] === first[ci])) len = ci + 1;
                                            else break;
                                          }
                                          return len > 2 ? len : 0;
                                        })()
                                      : 0;
                                    return allVals.map((v) => {
                                      const full = String(v);
                                      const label = pfxLen2 > 0 ? full.slice(pfxLen2).trimStart() : full;
                                      return (
                                        <SelectItem
                                          key={full}
                                          value={full}
                                          className="text-xs font-mono"
                                        >
                                          {label || full}
                                        </SelectItem>
                                      );
                                    });
                                  })()}
                                </SelectContent>
                              </Select>
                            );
                          }
                          return (
                            <Input
                              disabled={!isEnabled}
                              type={typeof phase.value === "number" ? "number" : "text"}
                              value={phase.value !== null && phase.value !== undefined ? String(phase.value) : ""}
                              onChange={(e) => {
                                const rawVal = e.target.value;
                                if (typeof phase.value === "number") {
                                  updatePhaseField(idx, "value", parseFloat(rawVal) || 0.0);
                                } else {
                                  updatePhaseField(idx, "value", rawVal);
                                }
                              }}
                              className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 font-mono"
                              step="0.1"
                            />
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  
                  {/* Configurable Mask Start */}
                  <div className="flex flex-col gap-1 mt-1">
                    <label className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider text-left">Mask Start</label>
                    <div className="flex gap-1.5">
                      <Select
                        disabled={!isEnabled}
                        value={phase.mask !== undefined && phase.mask !== null && phase.mask !== 'previous' ? "custom" : "previous"}
                        onValueChange={(val) => {
                          if (val === "previous") {
                            updatePhaseField(idx, "mask", "previous");
                          } else {
                            updatePhaseField(idx, "mask", 0);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs">
                          <SelectItem value="previous" className="text-xs">From prev phase</SelectItem>
                          <SelectItem value="custom" className="text-xs">Custom time</SelectItem>
                        </SelectContent>
                      </Select>
                      {phase.mask !== undefined && phase.mask !== null && phase.mask !== 'previous' && (
                        <Input
                          disabled={!isEnabled}
                          type="number"
                          step="0.1"
                          min="0"
                          className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-1.5 font-mono w-[80px]"
                          value={phase.mask ?? 0}
                          onChange={(e) => updatePhaseField(idx, "mask", parseFloat(e.target.value) || 0)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
