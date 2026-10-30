import {it,expect} from 'vitest';
import {unstable_readConfig} from 'wrangler';
it('declares the credential-free browser binding explicitly for DEV and production',()=>{
  const dev=unstable_readConfig({config:'wrangler.toml'}),production=unstable_readConfig({config:'wrangler.toml',env:'production'});
  expect(dev.name).toBe('3d-review-dev');expect(dev.browser?.binding).toBe('PDF_BROWSER');expect(production.name).toBe('3d-review');expect(production.browser?.binding).toBe('PDF_BROWSER');
});
