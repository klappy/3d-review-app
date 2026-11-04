// The account menu's navigation depends on the current identity, not on every review read finishing.
// A bounded optional history read never turns unknown history into an empty-account claim.
import { api, classify } from './api.js';
import { homeModel, menuModel } from './data.js';
import { initialsOf } from './session.js';

export const MENU_READ_LIMIT_MS = 2000;

async function boundedRead(read, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

function requireIdentity(me) {
  if (me?.principal?.kind === 'anonymous') {
    const error = new Error('Sign in to open workspace and account actions.');
    error.code = 'NOT_AUTHENTICATED';
    throw error;
  }
  if (typeof me?.principal?.id !== 'string' || !me.principal.id) throw new Error('Your sign-in could not be checked. Try again.');
  return me;
}

// This probe is uncached: a late result cannot overwrite session.js's cached identity.
// Authentication errors propagate to Live's existing sign-in gate; transient/timeout errors remain retryable failures.
export async function loadMenuIdentity({ read = () => api('/v2/me'), timeoutMs = MENU_READ_LIMIT_MS } = {}) {
  return requireIdentity(await boundedRead(read, timeoutMs, 'Your sign-in could not be checked. Try again.'));
}

export async function loadMenuModel(me, { onSignOut, currentDesign, readHome = homeModel, timeoutMs = MENU_READ_LIMIT_MS } = {}) {
  requireIdentity(me);
  try {
    const home = await boundedRead(() => readHome(me), timeoutMs, 'The review list did not finish loading.');
    return { ...menuModel(me, home, { onSignOut, currentDesign }), historyStatus: 'ready' };
  } catch (error) {
    if (classify(error) === 'unauthenticated') throw error;
    const menu = menuModel(me, { user: { initials: initialsOf(me.principal) }, workspace: 'Your workspace', groups: [], completed: [] }, { onSignOut, currentDesign });
    return {
      ...menu, chips: [], completed: null, historyStatus: 'unavailable',
      historyMessage: 'Your review list could not be loaded. Account actions are still available.',
      items: menu.items.map(row => row[1] === 'Your workspace — your workspace' ? [row[0], 'Your workspaces', row[2]] : row),
    };
  }
}

// The live account overlay is navigation, not another Home read. Identity is the only required read.
export function accountMenuModel(me, { onSignOut, currentDesign } = {}) {
  requireIdentity(me);
  const model = menuModel(me, { user: { initials: initialsOf(me.principal) }, workspace: 'Your workspace', groups: [], completed: [] }, { onSignOut, currentDesign });
  return { ...model, reviews: [], chips: [], completed: null, items: model.items.map(row => row[1] === 'Your workspace — your workspace' ? [row[0], 'Your workspaces', row[2]] : row) };
}
