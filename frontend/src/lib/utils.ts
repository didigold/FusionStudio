import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getOmScenarioName(filePath: string): string {
  if (!filePath) return '';
  const parts = filePath.replace(/\\/g, '/').split('/');
  const isOM = parts.some(p => p === 'OM' || p === 'Out of Position' || p === 'Correct Seatbelt Routing' || p === 'Correct Belt Routing' || p === 'Stature Detection');
  
  if (!isOM || parts.length < 3) {
    return filePath.split(/[\\/]/).pop()?.replace(/\.mf4$/i, '').replace(/_tracking$/i, '') || filePath;
  }
  
  const parent = parts[parts.length - 2];
  const grandparent = parts[parts.length - 3];
  const fileName = parts[parts.length - 1].replace(/\.mf4$/i, '').replace(/_tracking$/i, '');
  
  // If parent is a short modifier like 20cm or Left, include grandparent
  if (['20cm', 'center', 'left', 'right'].includes(parent.toLowerCase())) {
    return `${grandparent} - ${parent} (Attempt ${fileName})`;
  } else {
    return `${parent} (Attempt ${fileName})`;
  }
}

export function getOmScenarioCategory(filePath: string): string | null {
  if (!filePath) return null;
  const path = filePath.toLowerCase();
  
  if (path.includes('out of position')) {
    if (path.includes('initial phase')) return 'OoP — Initial Phase';
    if (path.includes('change of status')) return 'OoP — Change of Status';
    if (path.includes('15 minutes warning')) return 'OoP — 15 min Warning';
  } else if (path.includes('correct seatbelt routing') || path.includes('correct belt routing')) {
    if (path.includes('initial phase')) return 'CSR — Initial Phase';
    if (path.includes('change of status')) return 'CSR — Change of Status';
  }
  
  return null;
}