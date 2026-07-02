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