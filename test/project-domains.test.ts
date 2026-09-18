import { describe, expect, it } from "vitest";
import { unstable_readConfig } from "wrangler";
import { invitationMessage, publicOrigin } from "../src/mail";

const config = new URL("../wrangler.toml", import.meta.url).pathname;
describe("canonical project domains", () => {
  it.each([
    { env: undefined, origin: "https://dev.3dreview.app", host: "dev.3dreview.app", worker: "3d-review-dev" },
    { env: "production", origin: "https://3dreview.app", host: "3dreview.app", worker: "3d-review" },
  ])("$origin uses the matching worker route and invitation origin", ({ env, origin, host, worker }) => {
    const c = unstable_readConfig({ config, ...(env ? { env } : {}) });
    expect(c.name).toBe(worker);
    expect(c.routes).toContainEqual({ pattern: host, custom_domain: true });
    const base = publicOrigin(c.vars as any);
    expect(base).toBe(origin);
    const mail = invitationMessage(base!, "local-fixture/+", "viewer", "assessment", 7);
    const link = new URL(mail.link);
    expect(link.origin).toBe(origin); expect(link.search).toBe("");
    expect(link.hash).toBe("#invite=local-fixture%2F%2B");
    expect(mail.text).toContain(mail.link); expect(mail.html).toContain(mail.link);
  });
  it("retains existing aliases without creating a new production workers.dev entry", () => {
    const dev = unstable_readConfig({ config });
    const prod = unstable_readConfig({ config, env: "production" });
    expect(dev.workers_dev).toBe(true);
    expect(prod.workers_dev).toBe(false);
    expect(prod.routes).toContainEqual({ pattern: "3d-review.klappy.dev", custom_domain: true });
    expect(dev.vars.ACCESS_AUD).not.toBe(prod.vars.ACCESS_AUD);
  });
});
