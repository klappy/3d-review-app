// Diagnostic path redaction for the staff #events log. The network request keeps the exact path;
// only what is written to the page/console changes. Applied BEFORE any log line is built — never log then erase.
const INVITATION_ACCEPT=/^(\/v2\/invitations\/)[^/?#]+(\/accept(?:[?#].*)?)$/;
export function redactDiagnosticPath(url){
  if(typeof url!=='string')return url;
  const m=url.match(INVITATION_ACCEPT);
  return m?`${m[1]}[redacted]${m[2].replace(/[?#].*$/,'')}`:url;
}
