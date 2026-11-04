// Browser readiness must reject pending shells, even when their wording changes.
// Self-contained so Playwright can serialize this function into the page.
export function hasTerminalUi() {
  const main = document.querySelector('main');
  if (!main || document.querySelector('[data-loading-frame]') || main.matches('[aria-busy="true"]') || main.querySelector('[aria-busy="true"]')) return false;
  const notices = main.querySelectorAll('h1,h2,[role="status"],[aria-live]');
  if ([...notices].some(node => /^Loading(?:\s|[.…]|$)/i.test((node.textContent ?? '').trim()))) return false;
  const heading = main.querySelector('h1,h2,[role="heading"]');
  if (!heading) return false;
  const action = main.querySelector('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
  const failure = /^(Something went wrong|Not visible to you|Not found|Not available yet)$/i.test(heading.textContent?.trim() ?? '') || !!main.querySelector('[role="alert"]');
  if (failure) return !!action;
  return !!action || !!main.querySelector('section,article,form,table');
}

export async function requireTerminalPage(page, what, { timeoutMs = 30000, allowError = false } = {}) {
  try { await page.waitForFunction(hasTerminalUi, null, { timeout: timeoutMs }); }
  catch {
    const text = ((await page.textContent('body')) ?? '').replace(/\s+/g, ' ').slice(0, 180);
    throw new Error(`${what}: no usable terminal UI within ${timeoutMs}ms: ${text}`);
  }
  const text = ((await page.textContent('main')) ?? '').replace(/\s+/g, ' ');
  if (!allowError && /Something went wrong|Not visible to you|Could not load|Try again|API unavailable/i.test(text)) {
    throw new Error(`${what}: the page reached a failure state: ${text.slice(0, 180)}`);
  }
}

export async function verifyAccountMenuAndSignOut(page, { timeoutMs = 15000 } = {}) {
  // A failed menu click must fail acceptance, not get swallowed before DONE clean.
  await page.click('summary[aria-label^="Account menu"]');
  await page.waitForSelector('details[open] a.mi:has-text("Account settings")', { state: 'visible', timeout: timeoutMs });
  await page.waitForSelector('details[open] a.mi:has-text("Projects")', { state: 'visible', timeout: timeoutMs });
  const signOut = 'details[open] button.mi:has-text("Sign out")';
  await page.waitForSelector(signOut, { state: 'visible', timeout: timeoutMs });
  await page.click(signOut);
  await page.waitForSelector('text=Sign in', { state: 'visible', timeout: timeoutMs });
  await requireTerminalPage(page, 'sign out', { timeoutMs });
}
