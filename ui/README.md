# Temporary functional UI shell

This is an integration adapter, not the Design lane's visual system or approved copy. It uses the live `/v2` HTTP API only; no browser-only business logic or fixture responses. The Design lane may replace `ui/`.

Run the Worker separately (`npm run migrate:local`, `npm run seed:local`, `npm run dev`, with a local `.dev.vars` as documented by the Worker), then `node ui/server.mjs`. Open `http://localhost:5174`. The UI server serves this directory and proxies `/v2` to `http://localhost:8787`; it is local-only and has no deployment configuration. Set `UI_PORT` and `UI_API_ORIGIN` to use other local ports.

Local synthetic sign-in: request an email code, then use the `dev_only_code` returned by the Worker in `ENVIRONMENT=dev`. Creating a project requires a provisioned principal; the synthetic seed includes one, but the email-code stub does not grant that identity. Select a seeded project if signed in with matching provisioned fixture credentials. A newly selected survey stays closed in the current API; participant submission requires an open survey. Secure code issue/export is a separate pending backend change. These are shown as unavailable/held, not simulated.
