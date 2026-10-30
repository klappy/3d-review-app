import {it,expect} from 'vitest';
import {unstable_readConfig} from 'wrangler';
it('enables the credential-free browser binding only on DEV, with no production inheritance',()=>{
  const dev=unstable_readConfig({config:'wrangler.toml'}),production=unstable_readConfig({config:'wrangler.toml',env:'production'});
  expect(dev.name).toBe('3d-review-dev');expect(dev.browser?.binding).toBe('PDF_BROWSER');expect(production.name).toBe('3d-review');expect(production.browser).toBeUndefined();
});
