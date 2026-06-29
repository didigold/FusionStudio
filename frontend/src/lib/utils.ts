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
  const path = filePath.replace(/\\/g, '/').toLowerCase();
  
  if (path.includes('out of position') || path.includes('oop')) {
    if (path.includes('initial phase') || path.includes('initial_phase')) return 'OoP \u2014 Initial Phase';
    if (path.includes('change of status') || path.includes('change_of_status')) return 'OoP \u2014 Change of Status';
    if (path.includes('15 minutes') || path.includes('15 min') || path.includes('15_minutes')) return 'OoP \u2014 15 min Warning';
  } else if (
    path.includes('correct belt') ||
    path.includes('correct_belt') ||
    path.includes('csr') ||
    path.includes('seatbelt') ||
    path.includes('belt routing')
  ) {
    if (path.includes('initial phase') || path.includes('initial_phase')) return 'CSR \u2014 Initial Phase';
    if (path.includes('change of status') || path.includes('change_of_status')) return 'CSR \u2014 Change of Status';
  }
  
  return null;
}