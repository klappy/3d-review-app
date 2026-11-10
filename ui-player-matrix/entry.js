import { mount } from 'svelte';
import HomepageCase from './HomepageCase.svelte';
import ReducedCase from './ReducedCase.svelte';
import { CASES } from './cases.js';
import { observe } from './observe.js';
const configuration = CASES.find(item => item.id === document.body.dataset.case);
if (!configuration) throw new Error('Unknown player case');
if (configuration.kind !== 'native') {
  mount(configuration.kind === 'homepage' ? HomepageCase : ReducedCase, { target: document.getElementById('player'), props: { configuration } });
}
// Svelte actions finish in the microtask following mount. Observation never loads/plays.
queueMicrotask(() => {
  const video = document.querySelector('video');
  if (video) observe(video, document.getElementById('state'));
});
