import type { Gif, Safety } from './types.js';

/**
 * Best-effort keyword safety filter.
 *
 * Wikimedia Commons has no content rating, so this is a denylist applied to the
 * query and to each result's title, description and categories. Openverse
 * results are additionally filtered on its `mature` flag and sensitivity
 * markers. It is deliberately conservative; it is not a guarantee.
 *
 * Allowlisted phrases (e.g. "breast cancer") are masked before the denylist
 * runs, so medical and food uses of an otherwise blocked word can pass
 * without weakening the default: surrounding blocked terms still match.
 */

// Blocked in every mode (sexual content, explicit hate symbols).
const ALWAYS: string[] = [
  'porn', 'porno', 'pornography', 'pornographic', 'nsfw', 'xxx', 'hentai', 'explicit',
  'nude', 'nudes', 'nudity', 'nudism', 'naked', 'topless', 'sex', 'sexual', 'sexuality', 'sexy',
  'erotic', 'erotica', 'fetish', 'bdsm', 'orgasm', 'masturbation', 'masturbating', 'intercourse',
  'ejaculation', 'striptease', 'stripper', 'genital', 'genitals', 'genitalia', 'penis', 'vagina',
  'vulva', 'testicle', 'testicles', 'scrotum', 'breast', 'breasts', 'nipple', 'nipples', 'boobs',
  'dildo', 'onlyfans', 'lingerie', 'swastika', 'nazi', 'neo-nazi', 'kkk',
];

// Additionally blocked in 'safe' mode (violence, gore, self-harm, hard drugs).
const SAFE_ONLY: string[] = [
  'gore', 'gory', 'decapitation', 'decapitated', 'beheading', 'beheaded', 'mutilation', 'mutilated',
  'corpse', 'corpses', 'cadaver', 'dead body', 'autopsy', 'execution', 'executed', 'hanging',
  'suicide', 'self-harm', 'torture', 'massacre', 'murder', 'killed', 'lynching', 'genocide',
  'gunshot', 'wound', 'wounds', 'bloody', 'cocaine', 'heroin', 'methamphetamine',
];

/**
 * Contexts in which a denylisted token is almost certainly not sexual.
 * Matched with the same word-boundary / hyphen-flexible rules as the denylist.
 */
const ALLOWED_PHRASES: string[] = [
  'breast cancer',
  'breast cancers',
  'breastfeeding',
  'breast feeding',
  'breast-feeding',
  'breastfed',
  'breast fed',
  'breast-fed',
  'breast milk',
  'breastmilk',
  'breast-milk',
  'chicken breast',
  'chicken breasts',
  'turkey breast',
  'turkey breasts',
  'duck breast',
  'duck breasts',
];

function compile(terms: string[], flags: string): RegExp {
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[\\s_-]?'));
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${esc.join('|')})(?=$|[^\\p{L}\\p{N}])`, flags);
}

const RE_ALWAYS = compile(ALWAYS, 'iu');
const RE_SAFE = compile(SAFE_ONLY, 'iu');
const RE_ALLOWED = compile(ALLOWED_PHRASES, 'giu');

function normalize(text: string): string {
  return text.normalize('NFKC').replace(/_/g, ' ');
}

/** Mask allowlisted phrases so the denylist can run on the remainder. */
export function maskAllowedPhrases(text: string): string {
  return text.replace(RE_ALLOWED, (m) => ' '.repeat(m.length));
}

/** Returns the matched term when `text` is not allowed under `safety`, else null. */
export function blockedTerm(text: string, safety: Safety): string | null {
  const normalized = maskAllowedPhrases(normalize(text));
  const m = RE_ALWAYS.exec(normalized) ?? (safety === 'safe' ? RE_SAFE.exec(normalized) : null);
  return m ? m[0].replace(/^[^\p{L}\p{N}]/u, '').toLowerCase() : null;
}

export function isGifAllowed(gif: Pick<Gif, 'title' | 'description'> & { categories?: string[] }, safety: Safety): boolean {
  const haystack = [gif.title, gif.description ?? '', ...(gif.categories ?? [])].join(' \n ');
  return blockedTerm(haystack, safety) === null;
}
