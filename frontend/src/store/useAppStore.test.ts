import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from './useAppStore';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn().mockReturnValue('mock-toast-id'),
  }
}));

// Mock global fetch
globalThis.fetch = vi.fn();

describe('useAppStore autoLoadChannelsAndMerge', () => {
  let consoleErrorSpy: any;
  const initialSignalsConfig = { 'High Speed': [{ name: 'ExistingSignal', alias: 'es', checked: true, operator: '>', threshold: '5' }] };
  const initialLoadedFiles = { 'High Speed': 'test.mf4' };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    useAppStore.setState({
      signalsConfig: initialSignalsConfig,
      loadedFiles: initialLoadedFiles,
      analysisResults: [
        {
          type: 'participant',
          children: [
            { type: 'file', path: 'D1_test.mf4' },
            { type: 'file', path: 'F1_test.mf4' },
            { type: 'file', path: 'test_OoP.mf4' }
          ]
        }
      ]
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('should handle API errors correctly when loading individual categories (isMisuse=false)', async () => {
    // Setup state for test
    const { autoLoadChannelsAndMerge } = useAppStore.getState();

    // Mock fetch to reject with an error
    (globalThis.fetch as any).mockRejectedValueOnce(new Error('Network Error'));

    // Call function
    await autoLoadChannelsAndMerge(undefined, 'Euro NCAP', undefined, false, undefined);

    // Verify error toast was called
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Failed to auto-load signals from files.');

    // Verify state hasn't changed
    const finalState = useAppStore.getState();
    expect(finalState.signalsConfig).toEqual(initialSignalsConfig);
    expect(finalState.loadedFiles).toEqual(initialLoadedFiles);
  });

  it('should handle API errors correctly when loading representative file (isMisuse=true)', async () => {
    // Setup state for test
    const { autoLoadChannelsAndMerge } = useAppStore.getState();

    // Mock fetch to reject with an error
    (globalThis.fetch as any).mockRejectedValueOnce(new Error('Network Error'));

    // Call function
    await autoLoadChannelsAndMerge(undefined, 'Euro NCAP', undefined, true, undefined);

    // Verify error toast was called
    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Failed to auto-load signals from files.');

    // Verify state hasn't changed
    const finalState = useAppStore.getState();
    expect(finalState.signalsConfig).toEqual(initialSignalsConfig);
    expect(finalState.loadedFiles).toEqual(initialLoadedFiles);
  });
});
