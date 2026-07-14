import { describe, it, expect } from 'vitest';
import { getOmScenarioCategory } from './utils';

describe('getOmScenarioCategory', () => {
  it('returns null for falsy or empty inputs', () => {
    expect(getOmScenarioCategory('')).toBeNull();
    // @ts-expect-error testing invalid input
    expect(getOmScenarioCategory(null)).toBeNull();
    // @ts-expect-error testing invalid input
    expect(getOmScenarioCategory(undefined)).toBeNull();
  });

  describe('Out of Position (OoP)', () => {
    it('matches Initial Phase', () => {
      expect(getOmScenarioCategory('C:/test/Out of Position/Initial Phase/video.mp4')).toBe('OoP — Initial Phase');
      expect(getOmScenarioCategory('C:\\test\\oop\\initial_phase\\video.mp4')).toBe('OoP — Initial Phase');
    });

    it('matches Change of Status', () => {
      expect(getOmScenarioCategory('C:/test/Out of Position/Change of Status/video.mp4')).toBe('OoP — Change of Status');
      expect(getOmScenarioCategory('C:\\test\\oop\\change_of_status\\video.mp4')).toBe('OoP — Change of Status');
    });

    it('matches 15 min Warning', () => {
      expect(getOmScenarioCategory('C:/test/Out of Position/15 minutes/video.mp4')).toBe('OoP — 15 min Warning');
      expect(getOmScenarioCategory('C:\\test\\oop\\15 min\\video.mp4')).toBe('OoP — 15 min Warning');
      expect(getOmScenarioCategory('C:/test/oop/15_minutes/video.mp4')).toBe('OoP — 15 min Warning');
    });

    it('returns null if no specific phase is matched', () => {
      expect(getOmScenarioCategory('C:/test/Out of Position/Unknown Phase/video.mp4')).toBeNull();
    });
  });

  describe('Correct Seatbelt Routing (CSR)', () => {
    it('matches Initial Phase', () => {
      expect(getOmScenarioCategory('C:/test/Correct Belt Routing/Initial Phase/video.mp4')).toBe('CSR — Initial Phase');
      expect(getOmScenarioCategory('C:\\test\\csr\\initial_phase\\video.mp4')).toBe('CSR — Initial Phase');
      expect(getOmScenarioCategory('C:/test/Seatbelt/Initial Phase/video.mp4')).toBe('CSR — Initial Phase');
    });

    it('matches Change of Status', () => {
      expect(getOmScenarioCategory('C:/test/Correct Belt Routing/Change of Status/video.mp4')).toBe('CSR — Change of Status');
      expect(getOmScenarioCategory('C:\\test\\csr\\change_of_status\\video.mp4')).toBe('CSR — Change of Status');
    });

    it('returns null if no specific phase is matched', () => {
      expect(getOmScenarioCategory('C:/test/Correct Belt/Unknown Phase/video.mp4')).toBeNull();
    });
  });

  describe('Unrelated paths', () => {
    it('returns null for unrelated paths', () => {
      expect(getOmScenarioCategory('C:/test/other/folder/video.mp4')).toBeNull();
      expect(getOmScenarioCategory('C:/test/Initial Phase/video.mp4')).toBeNull(); // Phase without category
    });
  });
});
