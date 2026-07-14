import { describe, it, expect } from 'vitest';
import { getOmScenarioName } from './utils';

describe('getOmScenarioName', () => {
  it('returns empty string for empty input', () => {
    expect(getOmScenarioName('')).toBe('');
  });

  it('returns cleaned filename for paths without OM keywords', () => {
    expect(getOmScenarioName('foo/bar/baz.mf4')).toBe('baz');
    expect(getOmScenarioName('some/other/path/file_tracking.mf4')).toBe('file');
    expect(getOmScenarioName('just_a_file.txt')).toBe('just_a_file.txt'); // No suffix to strip
  });

  it('returns cleaned filename for OM paths with less than 3 segments', () => {
    expect(getOmScenarioName('OM/01.mf4')).toBe('01');
    expect(getOmScenarioName('Out of Position/test.mf4')).toBe('test');
  });

  it('formats scenario name for standard OM paths', () => {
    expect(getOmScenarioName('OM/Initial Phase/01.mf4')).toBe('Initial Phase (Attempt 01)');
    expect(getOmScenarioName('Out of Position/Change of Status/02.mf4')).toBe('Change of Status (Attempt 02)');
    expect(getOmScenarioName('Correct Seatbelt Routing/Test Case/03')).toBe('Test Case (Attempt 03)');
  });

  it('includes grandparent for short modifier parents', () => {
    expect(getOmScenarioName('OM/Initial Phase/Left/01.mf4')).toBe('Initial Phase - Left (Attempt 01)');
    expect(getOmScenarioName('OM/Initial Phase/Right/02.mf4')).toBe('Initial Phase - Right (Attempt 02)');
    expect(getOmScenarioName('OM/Initial Phase/Center/03.mf4')).toBe('Initial Phase - Center (Attempt 03)');
    expect(getOmScenarioName('OM/Initial Phase/20cm/04.mf4')).toBe('Initial Phase - 20cm (Attempt 04)');
  });

  it('handles backslashes in paths', () => {
    expect(getOmScenarioName('OM\\Initial Phase\\Right\\01.mf4')).toBe('Initial Phase - Right (Attempt 01)');
    expect(getOmScenarioName('Out of Position\\Initial Phase\\02.mf4')).toBe('Initial Phase (Attempt 02)');
  });

  it('strips .mf4 and _tracking suffixes from filenames correctly', () => {
    expect(getOmScenarioName('OM/Initial Phase/01_tracking.mf4')).toBe('Initial Phase (Attempt 01)');
    expect(getOmScenarioName('OM/Initial Phase/02_tracking')).toBe('Initial Phase (Attempt 02)');
    expect(getOmScenarioName('OM/Initial Phase/03.MF4')).toBe('Initial Phase (Attempt 03)'); // case-insensitive
  });
});
