import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  Volume2,
  Timer,
  Gauge,
  Signal,
  AlertTriangle,
} from "lucide-react";
import { PiSeatbelt } from 'react-icons/pi';
import type { MisusePhase } from '@/store/useAppStore';

interface MisuseTimelineEditorProps {
  activeCategory: string;
  misuseCriteria: Record<string, MisusePhase[]>;
  setMisuseCriteria: (mc: Record<string, MisusePhase[]>) => void;
  availableSignals: string[];
}

const ALERT_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  'visual': {
    bg: "bg-amber-50 dark:bg-amber-400",
    text: "text-amber-700 dark:text-amber-950",
    border: "border-amber-400/40 dark:border-amber-500/80",
    icon: <Eye className="w-3.5 h-3.5 text-amber-500 dark:text-amber-900" />,
  },
  'audio': {
    bg: "bg-blue-50 dark:bg-blue-300",
    text: "text-blue-700 dark:text-blue-950",
    border: "border-blue-400/40 dark:border-blue-400/80",
    icon: <Volume2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-900" />,
  },
  'visual+audio': {
    bg: "bg-violet-50 dark:bg-violet-300",
    text: "text-violet-700 dark:text-violet-950",
    border: "border-violet-400/40 dark:border-violet-400/80",
    icon: <AlertTriangle className="w-3.5 h-3.5 text-violet-500 dark:text-violet-900" />,
  },
  'signal': {
    bg: "bg-emerald-50 dark:bg-emerald-400",
    text: "text-emerald-700 dark:text-emerald-950",
    border: "border-emerald-400/40 dark:border-emerald-500/80",
    icon: <Signal className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-900" />,
  },
};

export function MisuseTimelineEditor({
  activeCategory,
  misuseCriteria,
  setMisuseCriteria,
  availableSignals,
}: MisuseTimelineEditorProps) {

  const phases = misuseCriteria?.[activeCategory] || [];

  const isAudioPhase = (phase: MisusePhase) => {
    return phase.alertType === 'audio' || phase.alertType === 'visual+audio';
  };

  const updatePhaseField = (index: number, field: keyof MisusePhase, value: any) => {
    const newCriteria = { ...(misuseCriteria || {}) };
    const categoryPhases = [...(newCriteria[activeCategory] || [])];

    if (field === 'alertType') {
      const newAlertType = value as MisusePhase['alertType'];
      const isNowAudio = newAlertType === 'audio' || newAlertType === 'visual+audio';
      const isNowSignal = newAlertType === 'signal';
      categoryPhases[index] = {
        ...categoryPhases[index],
        alertType: newAlertType,
        signal: isNowAudio ? 'SoundPressure' : (isNowSignal ? (categoryPhases[index].signal || 'FaceOnFacia') : ''),
        min_freq: isNowAudio ? (categoryPhases[index].min_freq ?? 800) : undefined,
        max_freq: isNowAudio ? (categoryPhases[index].max_freq ?? 2000) : undefined,
        threshold: isNowAudio ? (categoryPhases[index].threshold ?? 0.5) : undefined,
        operator: isNowSignal ? (categoryPhases[index].operator || '==') : undefined,
        value: isNowSignal ? (categoryPhases[index].value ?? 1) : undefined,
      };
    } else {
      categoryPhases[index] = {
        ...categoryPhases[index],
        [field]: value,
      };
    }

    newCriteria[activeCategory] = categoryPhases;
    setMisuseCriteria(newCriteria);
  };

  const updatePhaseFields = (index: number, updates: Partial<MisusePhase>) => {
    const newCriteria = { ...(misuseCriteria || {}) };
    const categoryPhases = [...(newCriteria[activeCategory] || [])];

    categoryPhases[index] = {
      ...categoryPhases[index],
      ...updates,
    };

    newCriteria[activeCategory] = categoryPhases;
    setMisuseCriteria(newCriteria);
  };

  const getTimelineArrows = (category: string): string[] => {
    const p = misuseCriteria?.[category] || [];
    return p.map((phase) => {
      const tc = phase.timeConstraint;
      const unit = phase.timeConstraintUnit || 's';
      if (tc) return `${tc}${unit}`;
      return '';
    });
  };

  const arrows = getTimelineArrows(activeCategory);

  const phaseSignalOptions = useMemo(() => {
    return Array.from(new Set(availableSignals || [])).sort();
  }, [availableSignals]);

  const speedSignalOptions = useMemo(() => {
    const opts = new Set(availableSignals || []);
    opts.add('VehicleSpeed');
    opts.add('Vehicle_Speed');
    opts.add('v_vhcl');
    return Array.from(opts).sort();
  }, [availableSignals]);

  const audioSignalOptions = useMemo(() => {
    const opts = new Set(availableSignals || []);
    opts.add('SoundPressure');
    return Array.from(opts).sort();
  }, [availableSignals]);



  return (
    <div className="p-5 flex flex-col gap-4 flex-1 w-full min-h-0 justify-center items-center">
      <div className="w-full flex justify-center py-4 px-4 flex-1 items-center min-h-0">
        <div className="flex flex-row items-stretch border border-border/50 bg-surface-2/40 backdrop-blur-md rounded-xl shadow-md overflow-hidden w-full max-w-[1200px]">
          {/* Starting Trigger Node */}
          <div className="flex flex-col items-center justify-center w-[220px] shrink-0 bg-red-500/10 dark:bg-red-950/20 p-6 text-center relative border-r border-border/20">
            <PiSeatbelt className="w-12 h-12 text-red-600 dark:text-red-500 mb-3 animate-pulse" />
            <span className="text-sm font-extrabold text-red-600 dark:text-red-400 uppercase tracking-wider">
              Initial Trigger
            </span>
            <span className="text-sm font-semibold text-foreground/80 mt-1.5 leading-snug">
              {activeCategory.includes("OoP") ? "Out of Position" : "Correct Seatbelt Routing"}
            </span>
          </div>

          {/* Render Phases */}
          {phases.map((phase, idx) => {
            const isEnabled = phase.enabled !== false;
            const hasAudio = isAudioPhase(phase);
            const alertStyle = ALERT_STYLES[phase.alertType] || ALERT_STYLES['visual'];
            const isInitialAudioWarning = (activeCategory.toLowerCase().includes("csr") || activeCategory.toLowerCase().includes("oop")) && activeCategory.toLowerCase().includes("initial phase") && phase.phaseName === "Audio Warning";

            return (
              <React.Fragment key={idx}>
                {/* Separator / Transition Pill Column */}
                <div className={`relative w-12 shrink-0 flex items-center justify-center transition-opacity duration-200 ${!isEnabled ? 'opacity-40' : ''}`}>
                  {/* Vertical separator line */}
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-border/20"></div>
                  {/* Transition Pill */}
                  <div className="z-10 bg-surface-3 px-3 py-1 rounded-full border border-border/80 shadow-md text-xs font-bold text-foreground whitespace-nowrap">
                    {(() => {
                      const isCosOr15Min = activeCategory.toLowerCase().includes("change of status") || activeCategory.toLowerCase().includes("15 min");
                      const isCsr = activeCategory.toLowerCase().includes("csr");
                      const isInitial = activeCategory.toLowerCase().includes("initial phase");
                      const isCsrInitial = isCsr && isInitial;
                      const isOopInitial = activeCategory.toLowerCase().includes("oop") && isInitial;
                      
                      if (idx === 0) {
                        if (isCosOr15Min || isCsrInitial || isOopInitial) return "≤30s";
                        return arrows[idx] || "→";
                      }
                      if (idx === 1) {
                        if (isCsrInitial) return "→";
                        if (isCsr && isCosOr15Min) return "≥90s";
                        return arrows[idx] || "→";
                      }
                      if (idx === 2) {
                        return arrows[idx] || "→";
                      }
                      return arrows[idx] || "→";
                    })()}
                  </div>
                </div>

                {/* Phase Column */}
                <div className={`flex-1 min-w-[220px] flex flex-col gap-3.5 p-5 relative transition-all duration-200 ${
                  !isEnabled ? 'opacity-40 bg-surface-2/20' : 'hover:bg-surface-3/10'
                }`}>
                  {/* Column Header */}
                  <div className="flex items-center justify-between border-b border-border/20 pb-2.5">
                    <div className={`px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 shadow-sm transition-colors duration-200 ${
                      !isEnabled
                        ? "bg-surface-3 text-muted-foreground border-border/30"
                        : `${alertStyle.bg} ${alertStyle.text} ${alertStyle.border}`
                    }`}>
                      {alertStyle.icon}
                      <span className="text-xs font-bold">
                        {phase.phaseName}
                      </span>
                    </div>
                    
                    {/* Enable/disable toggle */}
                    <Checkbox
                      id={`misuse-phase-toggle-${idx}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => updatePhaseField(idx, "enabled", !!checked)}
                      className="h-4 w-4 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-3 mt-1">
                    {/* Alert Type Selector */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Alert Type</label>
                      <Select
                        disabled={!isEnabled}
                        value={phase.alertType}
                        onValueChange={(val) => updatePhaseField(idx, "alertType", val)}
                      >
                        <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20">
                          <SelectValue placeholder="Alert type" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs">
                          {(() => {
                            const isInitialPhase = (activeCategory.toLowerCase().includes("csr") || activeCategory.toLowerCase().includes("oop")) && activeCategory.toLowerCase().includes("initial phase");
                            const nameLower = phase.phaseName.toLowerCase();
                            
                            if (isInitialPhase) {
                              if (nameLower === "detection") {
                                return (
                                  <>
                                    <SelectItem value="visual" className="text-xs">
                                      <span className="flex items-center gap-1.5"><Eye className="w-3 h-3 text-amber-500" /> Visual</span>
                                    </SelectItem>
                                    <SelectItem value="signal" className="text-xs">
                                      <span className="flex items-center gap-1.5"><Signal className="w-3 h-3 text-emerald-500" /> Signal</span>
                                    </SelectItem>
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <SelectItem value="audio" className="text-xs">
                                      <span className="flex items-center gap-1.5"><Volume2 className="w-3 h-3 text-blue-500" /> Audio</span>
                                    </SelectItem>
                                    <SelectItem value="signal" className="text-xs">
                                      <span className="flex items-center gap-1.5"><Signal className="w-3 h-3 text-emerald-500" /> Signal</span>
                                    </SelectItem>
                                  </>
                                );
                              }
                            }
                            
                            return (
                              <>
                                {nameLower !== "detection" && (
                                  <SelectItem value="visual" className="text-xs">
                                    <span className="flex items-center gap-1.5"><Eye className="w-3 h-3 text-amber-500" /> Visual</span>
                                  </SelectItem>
                                )}
                                <SelectItem value="audio" className="text-xs">
                                  <span className="flex items-center gap-1.5"><Volume2 className="w-3 h-3 text-blue-500" /> Audio</span>
                                </SelectItem>
                                {nameLower !== "detection" && (
                                  <SelectItem value="visual+audio" className="text-xs">
                                    <span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-violet-500" /> Visual + Audio</span>
                                  </SelectItem>
                                )}
                                <SelectItem value="signal" className="text-xs">
                                  <span className="flex items-center gap-1.5"><Signal className="w-3 h-3 text-emerald-500" /> Signal</span>
                                </SelectItem>
                              </>
                            );
                          })()}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Signal selector (only show for signal alert type) */}
                    {phase.alertType === 'signal' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Signal</label>
                        <Select
                          disabled={!isEnabled}
                          value={phase.signal}
                          onValueChange={(val) => updatePhaseField(idx, "signal", val)}
                        >
                          <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20">
                            <SelectValue placeholder="Select signal" />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs max-h-[200px]">
                            {(phase.alertType === 'signal' ? phaseSignalOptions : audioSignalOptions).map((name) => (
                              <SelectItem key={name} value={name} className="text-xs">
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Operator & Value comparison for signal phases */}
                    {phase.alertType === 'signal' && (
                      <div className="flex gap-1.5">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Operator</label>
                          <Select
                            disabled={!isEnabled}
                            value={phase.operator || '=='}
                            onValueChange={(val) => updatePhaseField(idx, "operator", val)}
                          >
                            <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs">
                              <SelectItem value="None">None</SelectItem>
                              <SelectItem value="==">==</SelectItem>
                              <SelectItem value="!=">!=</SelectItem>
                              <SelectItem value=">">&gt;</SelectItem>
                              <SelectItem value="<">&lt;</SelectItem>
                              <SelectItem value=">=">&gt;=</SelectItem>
                              <SelectItem value="<=">&lt;=</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Value</label>
                          <Input
                            disabled={!isEnabled}
                            type="text"
                            className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 font-mono"
                            value={phase.value ?? ''}
                            onChange={(e) => updatePhaseField(idx, "value", e.target.value)}
                            placeholder="e.g. 1"
                          />
                        </div>
                      </div>
                    )}

                    {/* Audio frequency/threshold controls */}
                    {hasAudio && (
                      <div className="flex gap-1.5">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Min Hz</label>
                          <Input
                            disabled={!isEnabled}
                            type="number"
                            className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 font-mono"
                            value={phase.min_freq ?? 800}
                            onChange={(e) => updatePhaseField(idx, "min_freq", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Max Hz</label>
                          <Input
                            disabled={!isEnabled}
                            type="number"
                            className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 font-mono"
                            value={phase.max_freq ?? 2000}
                            onChange={(e) => updatePhaseField(idx, "max_freq", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Thresh</label>
                          <Input
                            disabled={!isEnabled}
                            type="number"
                            step="0.1"
                            className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 font-mono"
                            value={phase.threshold ?? 0.5}
                            onChange={(e) => updatePhaseField(idx, "threshold", parseFloat(e.target.value))}
                          />
                        </div>
                      </div>
                    )}

                    {/* Time Constraint */}
                    {(phase.timeConstraint || idx > 0) && phase.phaseName !== "Detection" && phase.phaseName !== "Audio Duration" && !isInitialAudioWarning && (
                      <div className="flex gap-1.5">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left flex items-center gap-1">
                            <Timer className="w-3 h-3" /> Time
                          </label>
                          <Input
                            disabled={!isEnabled}
                            type="text"
                            className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 font-mono"
                            value={phase.timeConstraint ?? ''}
                            onChange={(e) => updatePhaseField(idx, "timeConstraint", e.target.value)}
                            placeholder="e.g. ≤30"
                          />
                        </div>
                        <div className="flex flex-col gap-1 w-[65px]">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Unit</label>
                          <Select
                            disabled={!isEnabled}
                            value={phase.timeConstraintUnit || 's'}
                            onValueChange={(val) => updatePhaseField(idx, "timeConstraintUnit", val)}
                          >
                            <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border border-border text-xs">
                              <SelectItem value="s" className="text-xs">s</SelectItem>
                              <SelectItem value="min" className="text-xs">min</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {phase.periodRepetition !== undefined && (
                          <div className="flex flex-col gap-1 w-[65px]">
                            <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Gap ≤</label>
                            <Input
                              disabled={!isEnabled}
                              type="number"
                              step="1"
                              min="1"
                              className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-1.5 font-mono"
                              value={phase.periodRepetition ?? 3}
                              onChange={(e) => updatePhaseField(idx, "periodRepetition", parseInt(e.target.value) || 1)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Speed Condition Selector & Input */}
                    {(phase.speedCondition !== undefined || phase.speedMode !== undefined) && (
                      <div className="flex flex-col gap-2 border border-border/30 rounded-lg p-2.5 bg-surface-3/10">
                        <div className="flex items-center gap-1.5">
                          <Gauge className="w-3.5 h-3.5 text-primary/70" />
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Speed Condition</span>
                        </div>
                        
                        <div className="flex gap-1.5 items-end">
                          {/* Speed Mode Selector */}
                          <div className="flex flex-col gap-0.5 flex-1">
                            <label className="text-[10px] text-muted-foreground uppercase font-semibold text-left">Source</label>
                            <Select
                              disabled={!isEnabled}
                              value={phase.speedMode || 'manual'}
                              onValueChange={(val: 'manual' | 'signal') => {
                                if (val === 'manual') {
                                  updatePhaseFields(idx, {
                                    speedMode: val,
                                    speedCondition: "40",
                                    speedSignal: undefined
                                  });
                                } else {
                                  updatePhaseFields(idx, {
                                    speedMode: val,
                                    speedSignal: "VehicleSpeed",
                                    speedCondition: undefined
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 bg-surface-3/50 border border-border/50 text-[11px] text-foreground rounded px-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border border-border text-xs">
                                <SelectItem value="manual" className="text-xs">Manual</SelectItem>
                                <SelectItem value="signal" className="text-xs">Signal</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Speed Signal Dropdown (only if speedMode is signal) */}
                          {phase.speedMode === 'signal' ? (
                            <div className="flex flex-col gap-0.5 flex-1">
                              <label className="text-[10px] text-muted-foreground uppercase font-semibold text-left">Signal</label>
                              <Select
                                disabled={!isEnabled}
                                value={phase.speedSignal || 'VehicleSpeed'}
                                onValueChange={(val) => updatePhaseField(idx, "speedSignal", val)}
                              >
                                <SelectTrigger className="h-7 bg-surface-3/50 border border-border/50 text-[11px] text-foreground rounded px-1.5">
                                  <SelectValue placeholder="Signal" />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border border-border text-xs max-h-32 overflow-y-auto">
                                  {speedSignalOptions.map((name) => (
                                    <SelectItem key={name} value={name} className="text-xs">
                                      {name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            /* Speed Limit Input (only if speedMode is manual) */
                            <div className="flex flex-col gap-0.5 flex-1">
                              <label className="text-[10px] text-muted-foreground uppercase font-semibold text-left">
                                Value (km/h)
                              </label>
                              <Input
                                disabled={!isEnabled}
                                type="text"
                                className="h-7 bg-surface-3/50 border border-border/50 text-[11px] text-foreground rounded px-1.5 font-mono"
                                value={phase.speedCondition ?? ''}
                                onChange={(e) => updatePhaseField(idx, "speedCondition", e.target.value)}
                                placeholder="e.g. 40"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mask Mode Selector */}
                    {!(phase.phaseName.toLowerCase() === "detection" && phase.alertType === "visual") && (
                      <div className="flex gap-1.5 items-end">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Mask Mode</label>
                          <Select
                            disabled={!isEnabled}
                            value={(phase.mask === undefined || phase.mask === "previous" || phase.mask === "") ? "previous" : "manual"}
                            onValueChange={(val) => {
                              if (val === "previous") {
                                updatePhaseField(idx, "mask", "previous");
                              } else {
                                updatePhaseField(idx, "mask", 0);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-2 hover:bg-surface-3 hover:border-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border border-border text-popover-foreground backdrop-blur-xl text-xs">
                              <SelectItem value="previous" className="text-xs">Start (tgaze/Prev)</SelectItem>
                              <SelectItem value="manual" className="text-xs">Manual Mask</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {(phase.mask !== undefined && phase.mask !== "previous" && phase.mask !== "") && (
                          <div className="flex flex-col gap-1 w-[75px]">
                            <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider text-left">Mask (s)</label>
                            <Input
                              disabled={!isEnabled}
                              type="number"
                              className="h-8 bg-surface-3/50 border border-border/50 text-xs text-foreground rounded-lg px-1.5 font-mono"
                              value={typeof phase.mask === "number" ? phase.mask : parseFloat(phase.mask as string) || 0}
                              onChange={(e) => updatePhaseField(idx, "mask", parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
