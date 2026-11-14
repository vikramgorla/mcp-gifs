import { describe, expect, it } from 'vitest';
import { blockedTerm, isGifAllowed } from '../src/safety.js';

describe('safety filter', () => {
  it('blocks sexual/explicit terms in every mode', () => {
    for (const s of ['safe', 'moderate'] as const) {
      expect(blockedTerm('nude beach', s)).toBe('nude');
      expect(blockedTerm('NSFW dance', s)).toBe('nsfw');
      expect(blockedTerm('Category:Sexual_intercourse', s)).toBe('sexual');
    }
  });
  it('uses word boundaries (no Scunthorpe problems)', () => {
    expect(blockedTerm('Sussex and Essex coast', 'safe')).toBeNull();
    expect(blockedTerm('Middlesex cricket', 'safe')).toBeNull();
    expect(blockedTerm('Goretex jacket', 'safe')).toBeNull();
    expect(blockedTerm('cat happy dance', 'safe')).toBeNull();
  });
  it("blocks violence/gore only in 'safe'", () => {
    expect(blockedTerm('gore', 'safe')).toBe('gore');
    expect(blockedTerm('gore', 'moderate')).toBeNull();
    expect(blockedTerm('self harm', 'safe')).toBe('self harm');
    expect(blockedTerm('dead-body', 'safe')).toBe('dead-body');
  });
  it('checks title, description and categories of results', () => {
    expect(isGifAllowed({ title: 'Dance', description: null, categories: ['Nudity in art'] }, 'safe')).toBe(false);
    expect(isGifAllowed({ title: 'Dance', description: 'a torture scene', categories: [] }, 'safe')).toBe(false);
    expect(isGifAllowed({ title: 'Dance', description: 'a torture scene', categories: [] }, 'moderate')).toBe(true);
    expect(isGifAllowed({ title: 'Dancing cat', description: 'cute', categories: ['Cats'] }, 'safe')).toBe(true);
  });
});
