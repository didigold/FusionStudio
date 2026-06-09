import { useState, useEffect, useCallback } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'fusionstudio-theme'

// Module-level variables to share state across hook instances
let globalTheme: Theme = (() => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored === 'light' || stored === 'dark') ? stored : 'dark'
  }
  return 'dark'
})()

const listeners = new Set<(t: Theme) => void>()

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(globalTheme)

  useEffect(() => {
    const handleThemeChange = (newTheme: Theme) => {
      setTheme(newTheme)
    }
    listeners.add(handleThemeChange)
    return () => {
      listeners.delete(handleThemeChange)
    }
  }, [])

  const setThemeState = useCallback((t: Theme) => {
    globalTheme = t
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(t)
    localStorage.setItem(STORAGE_KEY, t)
    listeners.forEach(l => l(t))
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(globalTheme === 'dark' ? 'light' : 'dark')
  }, [setThemeState])

  return { theme, toggleTheme, setTheme: setThemeState, isDark: theme === 'dark' }
}
