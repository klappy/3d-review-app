import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { authReturnUI, clearAuthReturn, installLegacyAuthReturn } from './auth-return.js';

test('legacy real DOM sign-in actions re-arm intent before redirected links and AJAX forms handle them', () => {
  const dom = new JSDOM(`<a href="/v2/auth/access"><span>Sign in</span></a>
    <a href="/v2/auth/access" data-code-signin>Use a code</a>
    <a href="/v2/auth/email">Email link</a>
    <form action="/v2/auth/email" method="post"><button>Sign in</button></form>
    <a href="#survey">Take a survey</a><form action="/other"></form>`, { url: 'https://example.invalid/' });
  const { document, sessionStorage, MouseEvent, Event } = dom.window;
  installLegacyAuthReturn(document, sessionStorage);
  for (const anchor of document.querySelectorAll('a[href^="/v2/auth/"]')) {
    clearAuthReturn(sessionStorage);
    // This is the same bubbling phase used by emailLinksClick. It must see the
    // marker even when it cancels the link and redirects to the email page.
    const intercept = event => {
      assert.equal(authReturnUI(sessionStorage), 'legacy');
      event.preventDefault();
    };
    document.addEventListener('click', intercept);
    (anchor.firstElementChild ?? anchor).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    document.removeEventListener('click', intercept);
    assert.equal(authReturnUI(sessionStorage), 'legacy');
  }
  const emailForm = document.querySelector('form[action="/v2/auth/email"]');
  for (const ajax of [false, true]) {
    clearAuthReturn(sessionStorage);
    const submit = event => {
      assert.equal(authReturnUI(sessionStorage), 'legacy');
      if (ajax) event.preventDefault();
    };
    emailForm.addEventListener('submit', submit);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    emailForm.dispatchEvent(event);
    assert.equal(event.defaultPrevented, ajax, 'the intent listener never owns form submission');
    emailForm.removeEventListener('submit', submit);
  }
  clearAuthReturn(sessionStorage);
  document.querySelector('a[href="#survey"]').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
  document.querySelector('form[action="/other"]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(authReturnUI(sessionStorage), null);
  dom.window.close();
});
