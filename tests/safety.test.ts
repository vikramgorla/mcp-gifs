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

  it('allows medical and food phrases that contain an otherwise blocked word', () => {
    for (const s of ['safe', 'moderate'] as const) {
      expect(blockedTerm('breast cancer', s)).toBeNull();
      expect(blockedTerm('Breast-Cancer awareness', s)).toBeNull();
      expect(blockedTerm('Category:Breast_cancer', s)).toBeNull();
      expect(blockedTerm('breastfeeding newborn', s)).toBeNull();
      expect(blockedTerm('breast-feeding', s)).toBeNull();
      expect(blockedTerm('breast milk', s)).toBeNull();
      expect(blockedTerm('chicken breast recipe', s)).toBeNull();
      expect(blockedTerm('turkey breasts', s)).toBeNull();
    }
  });
  it('does not weaken the default: standalone or sexual uses stay blocked', () => {
    for (const s of ['safe', 'moderate'] as const) {
      expect(blockedTerm('breast', s)).toBe('breast');
      expect(blockedTerm('breasts', s)).toBe('breasts');
      expect(blockedTerm('nude breast cancer', s)).toBe('nude');
      expect(blockedTerm('breast cancer porn', s)).toBe('porn');
      expect(blockedTerm('sexy chicken breast', s)).toBe('sexy');
    }
  });
  it('still applies word-boundary matching around allowlisted phrases', () => {
    expect(blockedTerm('abrest cancerxyz', 'safe')).toBeNull();
    expect(isGifAllowed({ title: 'Breast cancer walk', description: 'awareness month', categories: ['Breast cancer'] }, 'safe')).toBe(true);
    expect(isGifAllowed({ title: 'Anatomy', description: null, categories: ['Breasts'] }, 'safe')).toBe(false);
  });
});
