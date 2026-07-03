import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import AnalysisTab from './pages/AnalysisTab'

import { TopNav } from './components/layout/TopNav'
import { useSystemWebSocket } from './components/layout/SystemBadge'
import { Toaster } from './components/ui/sonner'
import { SidebarProvider } from './components/ui/sidebar'
import { AnalysisSidebar } from './components/analysis/AnalysisSidebar'

export default function App() {
  useSystemWebSocket()

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Global typing sound listener
  useEffect(() => {
    const playTypeSound = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        const isPrintable = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter';
        if (isPrintable && !e.ctrlKey && !e.altKey && !e.metaKey) {
          new Audio('/sounds/type_01.wav').play().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', playTypeSound, true);
    return () => window.removeEventListener('keydown', playTypeSound, true);
  }, []);

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
        new Audio('/sounds/notification.wav').play().catch(() => {});
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <BrowserRouter>
      <SidebarProvider defaultOpen={false} className="h-screen min-h-0 font-['Sofia_Sans']">
        {/* App-level sidebar */}
        <AnalysisSidebar />

        {/* Right side: TopNav + Content */}
        <div className="flex flex-col flex-1 min-w-0 h-screen bg-background text-foreground overflow-hidden relative">
          <TopNav />
          <Toaster />

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden pt-2 px-4 pb-4">
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