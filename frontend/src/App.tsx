import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import AnalysisTab from './pages/AnalysisTab'

import { TopNav } from './components/layout/TopNav'
import { useSystemWebSocket } from './components/layout/SystemBadge'
import { Toaster } from './components/ui/sonner'

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
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden font-['Sofia_Sans'] relative">
        <TopNav />
        <Toaster />

        {/* Main Content Area (padded top to account for the floating nav) */}
        <div className="flex flex-1 overflow-hidden pt-28 px-12 pb-12">
          <main className="flex-1 overflow-hidden rounded-[40px] shadow-sm relative">
            <Routes>
              <Route path="/" element={<AnalysisTab />} />
              <Route path="/analysis" element={<AnalysisTab />} />
              <Route path="*" element={<AnalysisTab />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}