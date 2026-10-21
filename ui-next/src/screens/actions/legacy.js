// UI Next (v4) actions lane adapter over the current UI's share and print modules. Status: provisional.
// ui/assess/share.js and ui/assess/print-lang.js are DOM-free but import the legacy trees behind them (vendor-qrcode, shared-link,
// review-gate, learn-more, participate/i18n, stage-screens), which a static import pulls into /next/ for two constants and one
// function. This adapter states those three things over the one data module they rest on (ui/v3/lwc.js, no imports), and
// test/ui-next-actions-screens.test.ts holds them equal to the current UI's own exports, so a change there fails here.
import { lwcByCode, MAX_LWC } from "../../../../ui/v3/lwc.js";

// ui/assess/share.js CAN_SHARE (issue_link / revoke_link roles) and copy.readOnly.
export const CAN_SHARE = new Set(["owner", "member"]);
export const READ_ONLY = "Your role here cannot share participant links (owner or member can).";

// ui/assess/print-lang.js PRINT_IN_LANGUAGE and printLanguages(): the assessment's LWCs, then the project's, once each,
// machine-translatable only, at most MAX_LWC; English is not in the list (the picker offers it first).
export const PRINT_IN_LANGUAGE = true;
export function printLanguages(assessmentLwc = [], projectLwc = []) {
  const codes = [];
  for (const raw of [...(Array.isArray(assessmentLwc) ? assessmentLwc : []), ...(Array.isArray(projectLwc) ? projectLwc : [])]) {
    const l = lwcByCode(raw);
    if (l && l.mt !== false && !codes.includes(l.code)) codes.push(l.code);
  }
  return codes.slice(0, MAX_LWC).map(lwcByCode);
}
