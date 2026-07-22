import { useState, useEffect, useCallback, type CSSProperties } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'fusionstudio-theme'
const COLOR_THEME_STORAGE_KEY = 'fusionstudio-color-theme'

export interface ColorTheme {
  id: string;
  name: string;
  previewLight: string;
  previewDark: string;
  light: {
    background: string;
    surface1: string;
    surface2: string;
    surface3: string;
    surfaceInk: string;
    border: string;
    hover: string;
    active: string;
  };
  dark: {
    background: string;
    surface1: string;
    surface2: string;
    surface3: string;
    surfaceInk: string;
    border: string;
    hover: string;
    active: string;
  };
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'default',
    name: 'Default',
    previewLight: '#F5F3F0',
    previewDark: '#121214',
    light: {
      background: '#F5F3F0',
      surface1: '#F0EEEB',
      surface2: '#FFFFFF',
      surface3: '#E8E5E1',
      surfaceInk: '#FAFAF9',
      border: 'rgba(26, 25, 24, 0.12)',
      hover: 'rgba(0, 0, 0, 0.05)',
      active: 'rgba(0, 0, 0, 0.08)'
    },
    dark: {
      background: '#121214',
      surface1: '#18181C',
      surface2: '#222226',
      surface3: '#2E2E34',
      surfaceInk: '#0A0A0C',
      border: 'rgba(226, 226, 233, 0.08)',
      hover: 'rgba(255, 255, 255, 0.05)',
      active: 'rgba(255, 255, 255, 0.08)'
    }
  },
  {
    id: 'ocean',
    name: 'Deep Sapphire',
    previewLight: '#0E84E3',
    previewDark: '#1E40AF',
    light: {
      background: '#F0F7FF',
      surface1: '#E4EFF6',
      surface2: '#FFFFFF',
      surface3: '#D8E6F1',
      surfaceInk: '#FAFCFF',
      border: 'rgba(14, 165, 233, 0.15)',
      hover: 'rgba(14, 165, 233, 0.06)',
      active: 'rgba(14, 165, 233, 0.12)'
    },
    dark: {
      background: '#141C2F',
      surface1: '#1E2942',
      surface2: '#253454',
      surface3: '#324570',
      surfaceInk: '#0D131F',
      border: 'rgba(99, 102, 241, 0.15)',
      hover: 'rgba(99, 102, 241, 0.06)',
      active: 'rgba(99, 102, 241, 0.12)'
    }
  },
  {
    id: 'emerald',
    name: 'Forest Emerald',
    previewLight: '#10B981',
    previewDark: '#047857',
    light: {
      background: '#F0FBF4',
      surface1: '#E2F3E8',
      surface2: '#FFFFFF',
      surface3: '#D2EADB',
      surfaceInk: '#FAFEFB',
      border: 'rgba(34, 197, 94, 0.15)',
      hover: 'rgba(34, 197, 94, 0.06)',
      active: 'rgba(34, 197, 94, 0.12)'
    },
    dark: {
      background: '#121E18',
      surface1: '#1A2C23',
      surface2: '#213B2E',
      surface3: '#2D5240',
      surfaceInk: '#0C1410',
      border: 'rgba(52, 211, 153, 0.15)',
      hover: 'rgba(52, 211, 153, 0.06)',
      active: 'rgba(52, 211, 153, 0.12)'
    }
  },
  {
    id: 'amethyst',
    name: 'Vibrant Purple',
    previewLight: '#8B5CF6',
    previewDark: '#6D28D9',
    light: {
      background: '#FAF6FF',
      surface1: '#F1E8FC',
      surface2: '#FFFFFF',
      surface3: '#E5D6FA',
      surfaceInk: '#FCFAFF',
      border: 'rgba(168, 85, 247, 0.15)',
      hover: 'rgba(168, 85, 247, 0.06)',
      active: 'rgba(168, 85, 247, 0.12)'
    },
    dark: {
      background: '#1C1428',
      surface1: '#271C38',
      surface2: '#312347',
      surface3: '#433061',
      surfaceInk: '#120D1A',
      border: 'rgba(192, 132, 252, 0.15)',
      hover: 'rgba(192, 132, 252, 0.06)',
      active: 'rgba(192, 132, 252, 0.12)'
    }
  },
  {
    id: 'ruby',
    name: 'Crimson Red',
    previewLight: '#EF4444',
    previewDark: '#B91C1C',
    light: {
      background: '#FFF5F7',
      surface1: '#FCE3E7',
      surface2: '#FFFFFF',
      surface3: '#FAD0D5',
      surfaceInk: '#FFFBFC',
      border: 'rgba(239, 68, 68, 0.15)',
      hover: 'rgba(239, 68, 68, 0.06)',
      active: 'rgba(239, 68, 68, 0.12)'
    },
    dark: {
      background: '#1E1012',
      surface1: '#2A1619',
      surface2: '#371C20',
      surface3: '#4D272C',
      surfaceInk: '#140B0C',
      border: 'rgba(248, 113, 113, 0.15)',
      hover: 'rgba(248, 113, 113, 0.06)',
      active: 'rgba(248, 113, 113, 0.12)'
    }
  },
  {
    id: 'amber',
    name: 'Pumpkin Amber',
    previewLight: '#F59E0B',
    previewDark: '#B45309',
    light: {
      background: '#FFF8EC',
      surface1: '#FBEED7',
      surface2: '#FFFFFF',
      surface3: '#F4DEC0',
      surfaceInk: '#FFFDFB',
      border: 'rgba(245, 158, 11, 0.15)',
      hover: 'rgba(245, 158, 11, 0.06)',
      active: 'rgba(245, 158, 11, 0.12)'
    },
    dark: {
      background: '#1E150F',
      surface1: '#2C1E16',
      surface2: '#3A271C',
      surface3: '#523627',
      surfaceInk: '#140E0A',
      border: 'rgba(251, 191, 36, 0.15)',
      hover: 'rgba(251, 191, 36, 0.06)',
      active: 'rgba(251, 191, 36, 0.12)'
    }
  },
  {
    id: 'teal',
    name: 'Electric Cyan',
    previewLight: '#06B6D4',
    previewDark: '#0369A1',
    light: {
      background: '#F0FAFB',
      surface1: '#DCF3F5',
      surface2: '#FFFFFF',
      surface3: '#CAE8EB',
      surfaceInk: '#FAFEFE',
      border: 'rgba(20, 184, 166, 0.15)',
      hover: 'rgba(20, 184, 166, 0.06)',
      active: 'rgba(20, 184, 166, 0.12)'
    },
    dark: {
      background: '#111F24',
      surface1: '#182C33',
      surface2: '#203B45',
      surface3: '#2D5261',
      surfaceInk: '#0C1518',
      border: 'rgba(45, 212, 191, 0.15)',
      hover: 'rgba(45, 212, 191, 0.06)',
      active: 'rgba(45, 212, 191, 0.12)'
    }
  },
  {
    id: 'slate',
    name: 'Sunshine Gold',
    previewLight: '#EAB308',
    previewDark: '#A16207',
    light: {
      background: '#FFFDE8',
      surface1: '#FAF5D5',
      surface2: '#FFFFFF',
      surface3: '#F4ECB6',
      surfaceInk: '#FFFFFC',
      border: 'rgba(234, 179, 8, 0.15)',
      hover: 'rgba(234, 179, 8, 0.06)',
      active: 'rgba(234, 179, 8, 0.12)'
    },
    dark: {
      background: '#1D1C11',
      surface1: '#292818',
      surface2: '#373520',
      surface3: '#4D4A2D',
      surfaceInk: '#14130B',
      border: 'rgba(253, 224, 71, 0.15)',
      hover: 'rgba(253, 224, 71, 0.06)',
      active: 'rgba(253, 224, 71, 0.12)'
    }
  },
  {
    id: 'rose',
    name: 'Hot Magenta',
    previewLight: '#EC4899',
    previewDark: '#BE185D',
    light: {
      background: '#FFF0F5',
      surface1: '#FBE0EB',
      surface2: '#FFFFFF',
      surface3: '#F6CCE0',
      surfaceInk: '#FFFBFD',
      border: 'rgba(244, 63, 94, 0.15)',
      hover: 'rgba(244, 63, 94, 0.06)',
      active: 'rgba(244, 63, 94, 0.12)'
    },
    dark: {
      background: '#201018',
      surface1: '#2D1622',
      surface2: '#3B1C2C',
      surface3: '#52273D',
      surfaceInk: '#160B10',
      border: 'rgba(251, 113, 133, 0.15)',
      hover: 'rgba(251, 113, 133, 0.06)',
      active: 'rgba(251, 113, 133, 0.12)'
    }
  }
];

// Module-level variables to share state across hook instances
let globalTheme: Theme = (() => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY)
    return (stored === 'light' || stored === 'dark') ? stored : 'dark'
  }
  return 'dark'
})()

let globalColorTheme: string = (() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(COLOR_THEME_STORAGE_KEY) || 'default'
  }
  return 'default'
})()

const listeners = new Set<(t: Theme) => void>()
const colorThemeListeners = new Set<(t: string) => void>()

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(globalTheme)
  const [colorTheme, setColorTheme] = useState<string>(globalColorTheme)

  useEffect(() => {
    const handleSync = () => {
      setTheme((localStorage.getItem(STORAGE_KEY) as Theme) || 'dark')
      setColorTheme(localStorage.getItem(COLOR_THEME_STORAGE_KEY) || 'default')
    }
    const handleThemeChange = (newTheme: Theme) => {
      setTheme(newTheme)
    }
    const handleColorThemeChange = (newColorTheme: string) => {
      setColorTheme(newColorTheme)
    }
    listeners.add(handleThemeChange)
    colorThemeListeners.add(handleColorThemeChange)
    window.addEventListener('system-settings-synced', handleSync)

    return () => {
      listeners.delete(handleThemeChange)
      colorThemeListeners.delete(handleColorThemeChange)
      window.removeEventListener('system-settings-synced', handleSync)
    }
  }, [])

  const setThemeState = useCallback((t: Theme) => {
    globalTheme = t
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add(t)
    localStorage.setItem(STORAGE_KEY, t)
    listeners.forEach(l => l(t))
    saveSystemSettings({ theme: t })
  }, [])

  const setColorThemeState = useCallback((ct: string) => {
    globalColorTheme = ct
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, ct)
    colorThemeListeners.forEach(l => l(ct))
    saveSystemSettings({ color_theme: ct })
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState(globalTheme === 'dark' ? 'light' : 'dark')
  }, [setThemeState])

  const getThemeStyle = useCallback(() => {
    if (colorTheme === 'default') return {};
    const selected = COLOR_THEMES.find(t => t.id === colorTheme) || COLOR_THEMES[0];
    const colors = selected[theme];
    return {
      '--background': colors.background,
      '--color-background': colors.background,
      '--surface-1': colors.surface1,
      '--color-surface-1': colors.surface1,
      '--surface-2': colors.surface2,
      '--color-surface-2': colors.surface2,
      '--surface-3': colors.surface3,
      '--color-surface-3': colors.surface3,
      '--surface-ink': colors.surfaceInk,
      '--color-surface-ink': colors.surfaceInk,
      '--sidebar-hover': colors.hover,
      '--sidebar-active': colors.active,
    } as CSSProperties;
  }, [theme, colorTheme]);

  const getDefaultThemeStyle = useCallback(() => {
    const colors = COLOR_THEMES[0][theme];
    return {
      '--background': colors.background,
      '--color-background': colors.background,
      '--surface-1': colors.surface1,
      '--color-surface-1': colors.surface1,
      '--surface-2': colors.surface2,
      '--color-surface-2': colors.surface2,
      '--surface-3': colors.surface3,
      '--color-surface-3': colors.surface3,
      '--surface-ink': colors.surfaceInk,
      '--color-surface-ink': colors.surfaceInk,
      '--sidebar-hover': colors.hover,
      '--sidebar-active': colors.active,
    } as CSSProperties;
  }, [theme]);

  return { 
    theme, 
    toggleTheme, 
    setTheme: setThemeState, 
    isDark: theme === 'dark',
    colorTheme,
    setColorTheme: setColorThemeState,
    getThemeStyle,
    getDefaultThemeStyle
  }
}

export async function saveSystemSettings(settings: {
  theme?: string;
  color_theme?: string;
  recent_projects?: string[];
  sound_enabled?: boolean;
  sound_typing?: string;
  sound_notification?: string;
  sound_ui?: string;
}) {
  try {
    const recentStr = localStorage.getItem("recent_projects")
    const recent = recentStr ? JSON.parse(recentStr) : []
    const theme = localStorage.getItem(STORAGE_KEY) || "dark"
    const color_theme = localStorage.getItem(COLOR_THEME_STORAGE_KEY) || "default"
    const sound_enabled_str = localStorage.getItem("fusionstudio-sound-enabled")
    const sound_enabled = sound_enabled_str !== null ? sound_enabled_str === "true" : true
    const sound_typing = localStorage.getItem("fusionstudio-sound-typing") || "/sounds/type_01.wav"
    const sound_notification = localStorage.getItem("fusionstudio-sound-notification") || "/sounds/notification.wav"
    const sound_ui = localStorage.getItem("fusionstudio-sound-ui") || "/sounds/tap_01.wav"

    const payload = {
      theme: settings.theme !== undefined ? settings.theme : theme,
      color_theme: settings.color_theme !== undefined ? settings.color_theme : color_theme,
      recent_projects: settings.recent_projects !== undefined ? settings.recent_projects : recent,
      sound_enabled: settings.sound_enabled !== undefined ? settings.sound_enabled : sound_enabled,
      sound_typing: settings.sound_typing !== undefined ? settings.sound_typing : sound_typing,
      sound_notification: settings.sound_notification !== undefined ? settings.sound_notification : sound_notification,
      sound_ui: settings.sound_ui !== undefined ? settings.sound_ui : sound_ui,
    }

    await fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.error("Failed to save system settings to backend:", err)
  }
}
