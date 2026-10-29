// UI Next (v4) live chrome store. Status: provisional. The signed-in account the shared TopBar / PhoneHeader show when the live app is
// mounted ({ who, initials, workspace, workspaces, accountItems }); null in the gallery and the fixture harness, where the boards' values stay.
let CHROME = null;
export function setLiveChrome(c) { CHROME = c ? { ...c } : null; }
export const liveChrome = () => CHROME;
