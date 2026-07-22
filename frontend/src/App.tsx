import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import AnalysisTab from './pages/AnalysisTab'
import { useTheme } from './hooks/useTheme'
import { useSound, initSoundSettingsFromBackend } from './hooks/useSound'

import { TopNav } from './components/layout/TopNav'
import { useSystemWebSocket } from './components/layout/SystemBadge'
import { Toaster } from './components/ui/sonner'
import { SidebarProvider } from './components/ui/sidebar'
import { AnalysisSidebar } from './components/analysis/AnalysisSidebar'

export default function App() {
  useSystemWebSocket()
  const { getThemeStyle } = useTheme()
  const { playTypingSound, playNotificationSound } = useSound()

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Load persistent settings from the backend on boot
  useEffect(() => {
    async function initSettings() {
      try {
        const res = await fetch('/api/system/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.theme) {
            localStorage.setItem('fusionstudio-theme', data.theme);
            const root = document.documentElement;
            root.classList.remove('dark', 'light');
            root.classList.add(data.theme);
          }
          if (data.color_theme) {
            localStorage.setItem('fusionstudio-color-theme', data.color_theme);
          }
          if (data.recent_projects) {
            localStorage.setItem('recent_projects', JSON.stringify(data.recent_projects));
          }
          initSoundSettingsFromBackend(data);
          window.dispatchEvent(new Event('system-settings-synced'));
        }
      } catch (err) {
        console.error("Failed to load settings from backend on boot:", err);
      }
    }
    initSettings();
  }, []);

  // Global typing sound listener
  useEffect(() => {
    const playTypeSound = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const isPrintable = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter';
        if (isPrintable && !e.ctrlKey && !e.altKey && !e.metaKey) {
          playTypingSound();
        }
      }
    };
    window.addEventListener('keydown', playTypeSound, true);
    return () => window.removeEventListener('keydown', playTypeSound, true);
  }, [playTypingSound]);

  // Global notification sound listener
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      let toastAdded = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            if (node.hasAttribute('data-sonner-toast') || node.classList.contains('toast') || node.querySelector('[data-sonner-toast]')) {
              toastAdded = true;
              break;
            }
          }
        }
        if (toastAdded) break;
      }
      if (toastAdded) {
        playNotificationSound();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [playNotificationSound]);

  return (
    <BrowserRouter>
      <SidebarProvider defaultOpen={false} className="h-screen min-h-0 font-['Sofia_Sans']">
        {/* App-level sidebar */}
        <AnalysisSidebar />

        {/* Right side: TopNav + Content */}
        <div className="flex flex-col flex-1 min-w-0 h-screen bg-background text-foreground overflow-hidden relative" style={getThemeStyle()}>
          <TopNav />
          <Toaster />

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden pt-0 pr-2 pb-2 pl-0">
            <main className="flex-1 relative">
              <Routes>
                <Route path="/" element={<AnalysisTab />} />
                <Route path="/analysis" element={<AnalysisTab />} />
                <Route path="*" element={<AnalysisTab />} />
              </Routes>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </BrowserRouter>
  )
}