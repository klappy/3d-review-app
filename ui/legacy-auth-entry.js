// An explicit legacy entry must retain its UI choice through bare auth callbacks.
// One-use tab intent only; Next's own sign-in actions overwrite it when selected.
import { rememberAuthReturn } from './auth-return.js';
rememberAuthReturn('legacy');
