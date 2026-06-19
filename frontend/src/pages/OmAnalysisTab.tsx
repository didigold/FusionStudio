import { useState } from 'react'
import { MisuseTimeTab } from '../components/analysis/MisuseTimeTab'
import { MisuseLogicTab } from '../components/analysis/MisuseLogicTab'

export default function OmAnalysisTab() {
  const [activeTab, setActiveTab] = useState<'time' | 'logic'>('time')

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex items-center gap-2 p-2 border-b border-border/50 bg-surface-2/30 shrink-0">
        <button
          onClick={() => setActiveTab('time')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'time' 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'hover:bg-surface-3 text-muted-foreground'
          }`}
        >
          Misuse Time
        </button>
        <button
          onClick={() => setActiveTab('logic')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'logic' 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'hover:bg-surface-3 text-muted-foreground'
          }`}
        >
          Misuse Logic
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'time' && <MisuseTimeTab />}
        {activeTab === 'logic' && <MisuseLogicTab />}
      </div>
    </div>
  )
}