import type { Gif, Safety } from './types.js';

/**
 * Best-effort keyword safety filter.
 *
 * Wikimedia Commons has no content rating, so this is a denylist applied to the
 * query and to each result's title, description and categories. Openverse
 * results are additionally filtered on its `mature` flag and sensitivity
 * markers. It is deliberately conservative; it is not a guarantee.
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

function compile(terms: string[]): RegExp {
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[ -]/g, '[\\s_-]?'));
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${esc.join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu');
}

const RE_ALWAYS = compile(ALWAYS);
const RE_SAFE = compile(SAFE_ONLY);

/** Returns the matched term when `text` is not allowed under `safety`, else null. */
export function blockedTerm(text: string, safety: Safety): string | null {
  const normalized = text.normalize('NFKC').replace(/_/g, ' ');
  const m = RE_ALWAYS.exec(normalized) ?? (safety === 'safe' ? RE_SAFE.exec(normalized) : null);
  return m ? m[0].replace(/^[^\p{L}\p{N}]/u, '').toLowerCase() : null;
}

export function isGifAllowed(gif: Pick<Gif, 'title' | 'description'> & { categories?: string[] }, safety: Safety): boolean {
  const haystack = [gif.title, gif.description ?? '', ...(gif.categories ?? [])].join(' \n ');
  return blockedTerm(haystack, safety) === null;
}
