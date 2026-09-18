# Project domains

Canonical DEV is `https://dev.3dreview.app`; canonical production is `https://3dreview.app`. Git config maps these to the existing DEV and production Workers, respectively. Invitation emails use each environment's `PUBLIC_ORIGIN`. Existing DEV workers.dev and production `3d-review.klappy.dev` aliases remain; there is no cross-host redirect that could lose a participant fragment or move a session.

## Authentication and compatibility

Before the new host is treated as sign-in ready, add exactly `dev.3dreview.app/v2/auth/access` to the existing DEV Access application and `3dreview.app/v2/auth/access` to the existing production Access application. Preserve existing destinations, policies, application audiences, team domain and identity-provider configuration. No apex-wide Access gate: public/participant routes remain public under their existing application checks. Infrastructure owner verifies the exact supported destination update and readback separately; this file is not an applied receipt.

The app validates each environment's existing Access audience. Web sign-in returns a relative `/#session=…` location and host-only Secure cookie; OAuth parks a host-only `__Host-` cookie and uses relative Access/consent paths. Discovery and challenge URLs derive from the requesting origin. The borrowed provider validates registered client callback URIs; do not widen them or CORS for this domain change. Clients connecting to the new MCP URL may need a new authorization flow. Cookies and browser storage do not migrate between hosts; sign in again on the desired host.

Web API calls remain relative/same-origin. Shared participant links derive from the browser origin, so links created on a retained alias remain valid on that alias. Existing links are not rewritten, and fragment tokens are not redirected to another host. Invitation emails alone use the canonical configured origin.

## Release verification

This increment follows 0.6.0 through a separate normal main/DEV PR. Production promotes the same validated version, canonical pin and source in its separate PR. Git-connected builds own route deployment; no manual Worker upload or deployment. Retain the existing sender-only Cloudflare Email Sending configuration; web routes do not create inboxes or forwarding.

Tests read the effective Wrangler config and exercise local real OAuth discovery, PKCE, consent, session redirects and refusal on both new origins with synthetic identity/JWKS and isolated D1/KV. They do not prove DNS, TLS, Access edge configuration or live sign-in. After deployment, verify canonical DNS/TLS, health/version, visible page, Access challenge and actual authorized login separately. Never fabricate a successful login from a redirect or source inspection.
