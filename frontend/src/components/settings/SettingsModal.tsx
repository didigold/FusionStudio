import React, { useState } from 'react';
import { 
  Settings, 
  Sun, 
  Moon, 
  Palette, 
  Volume2, 
  VolumeX, 
  Play, 
  Info, 
  X,
  Keyboard,
  Bell,
  MousePointerClick,
  Sparkles
} from 'lucide-react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useTheme, COLOR_THEMES } from '@/hooks/useTheme';
import { 
  useSound, 
  TYPING_SOUND_OPTIONS, 
  NOTIFICATION_SOUND_OPTIONS, 
  UI_SOUND_OPTIONS 
} from '@/hooks/useSound';
import { useRipple } from '@/components/ui/Ripple';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const APP_VERSION = "1.029";

// Reusable Ripple Button component (isolated ripple state per button)
const RippleButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  onClick,
  className = '',
  ...props
}) => {
  const { addRipple, renderRipples } = useRipple();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    addRipple(e);
    if (onClick) onClick(e);
  };

  return (
    <button
      onClick={handleClick}
      className={cn("relative overflow-hidden cursor-pointer outline-none active:scale-[0.98]", className)}
      {...props}
    >
      {renderRipples()}
      {children}
    </button>
  );
};

// Custom Tab Button component
const TabButton: React.FC<{
  active: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => {
  return (
    <RippleButton
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left select-none",
        active
          ? "bg-primary/10 text-primary font-bold shadow-sm"
          : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-surface-3/50 font-medium"
      )}
    >
      <span className="shrink-0 relative z-10">{icon}</span>
      <span className="truncate relative z-10">{label}</span>
    </RippleButton>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onOpenChange }) => {
  const { toggleTheme, isDark, colorTheme, setColorTheme } = useTheme();
  const { 
    enabled: soundEnabled, 
    setEnabled: setSoundEnabled, 
    soundTyping, 
    setSoundTyping, 
    soundNotification, 
    setSoundNotification, 
    soundUi, 
    setSoundUi,
    playSoundFile 
  } = useSound();

  const [activeTab, setActiveTab] = useState<'appearance' | 'sounds' | 'about'>('appearance');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-surface-2 border border-border/70 shadow-2xl rounded-2xl sm:rounded-2xl">
        <div className="flex h-[520px]">
          {/* Full Height Left Sidebar Frame extending to top */}
          <div className="w-64 bg-surface-1/50 border-r border-border/40 p-4 flex flex-col justify-between shrink-0 select-none">
            <div className="space-y-4">
              {/* Left Top Brand / Title */}
              <div className="flex items-center gap-3 px-1 py-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-base font-extrabold text-foreground tracking-tight leading-tight">
                    Settings
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Preferences
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/40 w-full" />

              {/* Tab Navigation */}
              <div className="space-y-1.5">
                <TabButton
                  active={activeTab === 'appearance'}
                  onClick={() => setActiveTab('appearance')}
                  icon={<Palette className="w-4.5 h-4.5" />}
                  label="Appearance & Theme"
                />

                <TabButton
                  active={activeTab === 'sounds'}
                  onClick={() => setActiveTab('sounds')}
                  icon={<Volume2 className="w-4.5 h-4.5" />}
                  label="Sound Effects"
                />

                <TabButton
                  active={activeTab === 'about'}
                  onClick={() => setActiveTab('about')}
                  icon={<Info className="w-4.5 h-4.5" />}
                  label="About & System"
                />
              </div>
            </div>

            {/* Bottom Version Info Box */}
            <div className="p-3.5 rounded-xl bg-surface-1 border border-border/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground text-sm">FusionStudio</span>
                <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-mono text-xs font-bold">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Settings persist in local cache and backend.
              </p>
            </div>
          </div>

          {/* Full Height Right Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Right Header with Active Tab Title & Close Button */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface-2 shrink-0">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {activeTab === 'appearance' && "Appearance & Theme"}
                  {activeTab === 'sounds' && "Sound Effects"}
                  {activeTab === 'about' && "About & System"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTab === 'appearance' && "Personalize theme modes and accent colors"}
                  {activeTab === 'sounds' && "Configure global and event audio feedback"}
                  {activeTab === 'about' && "View system details and software version"}
                </p>
              </div>

              <RippleButton
                onClick={() => onOpenChange(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 relative z-10" />
              </RippleButton>
            </div>

            {/* Right Tab Content Panel */}
            <div className="flex-1 p-6 overflow-y-auto bg-surface-2">
              {/* TAB 1: APPEARANCE & THEME */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  {/* Dark / Light Toggle */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3 flex items-center gap-2">
                      <Sun className="w-4 h-4 text-primary" /> Appearance Mode
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <RippleButton
                        onClick={() => isDark && toggleTheme()}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl transition-all text-left",
                          !isDark
                            ? "bg-primary/10 text-foreground shadow-sm"
                            : "bg-surface-1/40 text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3.5 relative z-10">
                          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                            <Sun className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold">Light Mode</div>
                            <div className="text-xs opacity-75 mt-0.5">Clean light interface</div>
                          </div>
                        </div>
                        {!isDark && <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 relative z-10" />}
                      </RippleButton>

                      <RippleButton
                        onClick={() => !isDark && toggleTheme()}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl transition-all text-left",
                          isDark
                            ? "bg-primary/10 text-foreground shadow-sm"
                            : "bg-surface-1/40 text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3.5 relative z-10">
                          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
                            <Moon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold">Dark Mode</div>
                            <div className="text-xs opacity-75 mt-0.5">High-contrast dark design</div>
                          </div>
                        </div>
                        {isDark && <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 relative z-10" />}
                      </RippleButton>
                    </div>
                  </div>

                  {/* Color Schemes */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3 flex items-center gap-2">
                      <Palette className="w-4 h-4 text-primary" /> Accent Color Scheme
                    </h3>
                    <div className="grid grid-cols-2 gap-3.5">
                      {COLOR_THEMES.map((t) => {
                        const isSelected = colorTheme === t.id;
                        const previewBg = isDark ? t.previewDark : t.previewLight;
                        const isLightDefault = !isDark && t.id === 'default';
                        const starIconColor = isLightDefault ? "text-slate-900" : "text-white";

                        return (
                          <RippleButton
                            key={t.id}
                            onClick={() => setColorTheme(t.id)}
                            className={cn(
                              "flex items-center gap-3.5 p-3 rounded-xl transition-all text-left group",
                              isSelected
                                ? "bg-primary/10 shadow-sm font-bold text-foreground"
                                : "bg-surface-1/40 text-muted-foreground hover:bg-surface-1 hover:text-foreground"
                            )}
                          >
                            <div
                              className="w-7 h-7 rounded-lg border border-black/10 shrink-0 shadow-sm flex items-center justify-center transition-transform group-hover:scale-105 relative z-10"
                              style={{ backgroundColor: previewBg }}
                            >
                              {isSelected && <Sparkles className={cn("w-4 h-4 drop-shadow-sm", starIconColor)} />}
                            </div>
                            <div className="text-sm font-semibold whitespace-nowrap min-w-0 relative z-10">
                              {t.name}
                            </div>
                          </RippleButton>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SOUND EFFECTS */}
              {activeTab === 'sounds' && (
                <div className="space-y-6">
                  {/* Global Master Sound Switch */}
                  <div className="flex items-center justify-between p-4.5 rounded-xl border border-border/60 bg-surface-1/40">
                    <div className="flex items-center gap-3.5">
                      <div className={cn(
                        "p-3 rounded-xl transition-colors shrink-0",
                        soundEnabled ? "bg-emerald-500/10 text-emerald-500" : "bg-surface-3 text-muted-foreground"
                      )}>
                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">Sound Effects Enabled</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Enable audio feedback for UI actions, typing, and notifications
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={soundEnabled}
                      onCheckedChange={setSoundEnabled}
                    />
                  </div>

                  {/* Individual Sound Events */}
                  <div className={cn("space-y-4 transition-opacity", !soundEnabled && "opacity-50 pointer-events-none")}>
                    {/* Typing Sound */}
                    <div className="p-4 rounded-xl border border-border/40 bg-surface-1/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                          <Keyboard className="w-4 h-4 text-primary" />
                          Typing Keyboard Sound
                        </label>
                        <RippleButton
                          onClick={() => playSoundFile(soundTyping)}
                          title="Preview sound"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-3 text-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current relative z-10" />
                          <span className="relative z-10">Test</span>
                        </RippleButton>
                      </div>
                      <select
                        value={soundTyping}
                        onChange={(e) => setSoundTyping(e.target.value)}
                        className="w-full bg-surface-3 text-foreground border border-border/60 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 h-10 cursor-pointer"
                      >
                        {TYPING_SOUND_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Notification Sound */}
                    <div className="p-4 rounded-xl border border-border/40 bg-surface-1/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                          <Bell className="w-4 h-4 text-primary" />
                          Notification & Alert Sound
                        </label>
                        <RippleButton
                          onClick={() => playSoundFile(soundNotification)}
                          title="Preview sound"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-3 text-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current relative z-10" />
                          <span className="relative z-10">Test</span>
                        </RippleButton>
                      </div>
                      <select
                        value={soundNotification}
                        onChange={(e) => setSoundNotification(e.target.value)}
                        className="w-full bg-surface-3 text-foreground border border-border/60 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 h-10 cursor-pointer"
                      >
                        {NOTIFICATION_SOUND_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* UI Interaction Sound */}
                    <div className="p-4 rounded-xl border border-border/40 bg-surface-1/20 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2.5">
                          <MousePointerClick className="w-4 h-4 text-primary" />
                          UI Click / Tap Sound
                        </label>
                        <RippleButton
                          onClick={() => playSoundFile(soundUi)}
                          title="Preview sound"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-3 text-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 fill-current relative z-10" />
                          <span className="relative z-10">Test</span>
                        </RippleButton>
                      </div>
                      <select
                        value={soundUi}
                        onChange={(e) => setSoundUi(e.target.value)}
                        className="w-full bg-surface-3 text-foreground border border-border/60 rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 h-10 cursor-pointer"
                      >
                        {UI_SOUND_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ABOUT & SYSTEM */}
              {activeTab === 'about' && (
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-surface-1/60 to-surface-2 border border-primary/20 text-center space-y-3">
                    <img
                      src="/apple-touch-icon.png"
                      alt="FusionStudio Logo"
                      className="w-16 h-16 object-contain rounded-2xl mx-auto shadow-md border border-primary/20 bg-surface-1/80 p-1.5"
                    />
                    <div>
                      <h2 className="text-lg font-bold text-foreground">FusionStudio</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        ADAS Electronic Chassis Control Systems Analysis Suite
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-3/80 border border-border/60 text-xs font-mono font-bold text-primary">
                      <span>Version {APP_VERSION}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
                      System Architecture
                    </h3>
                    <div className="grid grid-cols-2 gap-3.5 text-sm">
                      <div className="p-4 rounded-xl border border-border/50 bg-surface-1/30">
                        <div className="text-xs text-muted-foreground font-medium">Framework & Engine</div>
                        <div className="font-bold text-foreground mt-0.5">FastAPI & React 19</div>
                      </div>
                      <div className="p-4 rounded-xl border border-border/50 bg-surface-1/30">
                        <div className="text-xs text-muted-foreground font-medium">Storage Engine</div>
                        <div className="font-bold text-foreground mt-0.5">%APPDATA% JSON Cache</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
