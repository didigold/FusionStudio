import { useState, useEffect, useCallback } from 'react';
import { saveSystemSettings } from './useTheme';

export const STORAGE_KEYS = {
  SOUND_ENABLED: 'fusionstudio-sound-enabled',
  SOUND_TYPING: 'fusionstudio-sound-typing',
  SOUND_NOTIFICATION: 'fusionstudio-sound-notification',
  SOUND_UI: 'fusionstudio-sound-ui',
};

export const TYPING_SOUND_OPTIONS = [
  { id: '/sounds/type_01.wav', label: 'Typing 1 (Soft)' },
  { id: '/sounds/type_02.wav', label: 'Typing 2 (Click)' },
  { id: '/sounds/type_03.wav', label: 'Typing 3 (Pop)' },
  { id: '/sounds/type_04.wav', label: 'Typing 4 (Mechanical)' },
  { id: '/sounds/type_05.wav', label: 'Typing 5 (Crisp)' },
];

export const NOTIFICATION_SOUND_OPTIONS = [
  { id: '/sounds/notification.wav', label: 'Default Notification' },
  { id: '/sounds/caution.wav', label: 'Caution Alert' },
  { id: '/sounds/celebration.wav', label: 'Celebration' },
  { id: '/sounds/ringtone_loop.wav', label: 'Chime' },
];

export const UI_SOUND_OPTIONS = [
  { id: '/sounds/tap_01.wav', label: 'Tap 1 (Soft)' },
  { id: '/sounds/tap_02.wav', label: 'Tap 2 (Subtle)' },
  { id: '/sounds/tap_03.wav', label: 'Tap 3 (Woodblock)' },
  { id: '/sounds/tap_04.wav', label: 'Tap 4 (Tick)' },
  { id: '/sounds/tap_05.wav', label: 'Tap 5 (Click)' },
  { id: '/sounds/button.wav', label: 'Button Click' },
  { id: '/sounds/select.wav', label: 'Select' },
  { id: '/sounds/swipe_01.wav', label: 'Swipe' },
];

let globalSoundEnabled: boolean = (() => {
  if (typeof window !== 'undefined') {
    const val = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    return val !== null ? val === 'true' : true;
  }
  return true;
})();

let globalSoundTyping: string = (() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.SOUND_TYPING) || '/sounds/type_01.wav';
  }
  return '/sounds/type_01.wav';
})();

let globalSoundNotification: string = (() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.SOUND_NOTIFICATION) || '/sounds/notification.wav';
  }
  return '/sounds/notification.wav';
})();

let globalSoundUi: string = (() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEYS.SOUND_UI) || '/sounds/tap_01.wav';
  }
  return '/sounds/tap_01.wav';
})();

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function useSound() {
  const [enabled, setEnabledState] = useState<boolean>(globalSoundEnabled);
  const [soundTyping, setSoundTypingState] = useState<string>(globalSoundTyping);
  const [soundNotification, setSoundNotificationState] = useState<string>(globalSoundNotification);
  const [soundUi, setSoundUiState] = useState<string>(globalSoundUi);

  useEffect(() => {
    const sync = () => {
      setEnabledState(globalSoundEnabled);
      setSoundTypingState(globalSoundTyping);
      setSoundNotificationState(globalSoundNotification);
      setSoundUiState(globalSoundUi);
    };

    const handleSystemSync = () => {
      const e = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
      if (e !== null) globalSoundEnabled = e === 'true';
      globalSoundTyping = localStorage.getItem(STORAGE_KEYS.SOUND_TYPING) || '/sounds/type_01.wav';
      globalSoundNotification = localStorage.getItem(STORAGE_KEYS.SOUND_NOTIFICATION) || '/sounds/notification.wav';
      globalSoundUi = localStorage.getItem(STORAGE_KEYS.SOUND_UI) || '/sounds/tap_01.wav';
      sync();
    };

    listeners.add(sync);
    window.addEventListener('system-settings-synced', handleSystemSync);

    return () => {
      listeners.delete(sync);
      window.removeEventListener('system-settings-synced', handleSystemSync);
    };
  }, []);

  const setEnabled = useCallback((val: boolean) => {
    globalSoundEnabled = val;
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(val));
    notifyListeners();
    saveSystemSettings({ sound_enabled: val });
  }, []);

  const setSoundTyping = useCallback((val: string) => {
    globalSoundTyping = val;
    localStorage.setItem(STORAGE_KEYS.SOUND_TYPING, val);
    notifyListeners();
    saveSystemSettings({ sound_typing: val });
  }, []);

  const setSoundNotification = useCallback((val: string) => {
    globalSoundNotification = val;
    localStorage.setItem(STORAGE_KEYS.SOUND_NOTIFICATION, val);
    notifyListeners();
    saveSystemSettings({ sound_notification: val });
  }, []);

  const setSoundUi = useCallback((val: string) => {
    globalSoundUi = val;
    localStorage.setItem(STORAGE_KEYS.SOUND_UI, val);
    notifyListeners();
    saveSystemSettings({ sound_ui: val });
  }, []);

  const playSoundFile = useCallback((src: string) => {
    if (!globalSoundEnabled) return;
    try {
      const audio = new Audio(src);
      audio.play().catch(() => {});
    } catch {
      // Ignore audio load errors
    }
  }, []);

  const playTypingSound = useCallback(() => {
    if (globalSoundEnabled && globalSoundTyping) {
      playSoundFile(globalSoundTyping);
    }
  }, [playSoundFile]);

  const playNotificationSound = useCallback(() => {
    if (globalSoundEnabled && globalSoundNotification) {
      playSoundFile(globalSoundNotification);
    }
  }, [playSoundFile]);

  const playUiSound = useCallback(() => {
    if (globalSoundEnabled && globalSoundUi) {
      playSoundFile(globalSoundUi);
    }
  }, [playSoundFile]);

  return {
    enabled,
    setEnabled,
    soundTyping,
    setSoundTyping,
    soundNotification,
    setSoundNotification,
    soundUi,
    setSoundUi,
    playSoundFile,
    playTypingSound,
    playNotificationSound,
    playUiSound,
  };
}

export function initSoundSettingsFromBackend(data: {
  sound_enabled?: boolean;
  sound_typing?: string;
  sound_notification?: string;
  sound_ui?: string;
}) {
  if (data.sound_enabled !== undefined) {
    globalSoundEnabled = Boolean(data.sound_enabled);
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(globalSoundEnabled));
  }
  if (data.sound_typing) {
    globalSoundTyping = data.sound_typing;
    localStorage.setItem(STORAGE_KEYS.SOUND_TYPING, data.sound_typing);
  }
  if (data.sound_notification) {
    globalSoundNotification = data.sound_notification;
    localStorage.setItem(STORAGE_KEYS.SOUND_NOTIFICATION, data.sound_notification);
  }
  if (data.sound_ui) {
    globalSoundUi = data.sound_ui;
    localStorage.setItem(STORAGE_KEYS.SOUND_UI, data.sound_ui);
  }
  notifyListeners();
}
