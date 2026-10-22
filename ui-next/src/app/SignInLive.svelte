<!-- UI Next (v4) sign-in, live. Status: provisional. The same two ways in as the current design's entry page (ui/assess/scope.js):
     an emailed sign-in link (POST /v2/auth/email; the link lands the signed-in browser at /#session=, and this page sends it on to /next/),
     and, on DEV only, a synthetic sandbox account (name@…example.invalid) whose code comes back in-band (POST /v2/auth/link + /v2/auth/session).
     The People lane's SignIn board drives the composition (screens/people/SignIn.svelte). -->
<script>
  import AppShell from "../AppShell.svelte";
  import Page from "../Page.svelte";
  import Card from "../Card.svelte";
  import Row from "../Row.svelte";
  import Stack from "../Stack.svelte";
  import TopBar from "../TopBar.svelte";
  import PhoneHeader from "../PhoneHeader.svelte";
  import { to } from "./router.js";
  import * as S from "./session.js";
  let { phone = false, theme = "light", onsignedin } = $props();
  let email = $state(""), code = $state(""), stage = $state("email"), status = $state(""), busy = $state(false), minutes = $state(30);
  const synthetic = $derived(/\.invalid$/i.test(email.trim()));
  // Email links are an environment fact (production normally has them off): probed once like the current UI; off → the sign-in is
  // the Access page (/v2/auth/access), a top-level navigation the server owns. Sandbox code sign-in needs no link.
  let links = $state(undefined);
  S.emailLinksOn().then((on) => { links = on; });
  async function sendLink(e) {
    e.preventDefault(); busy = true; status = "";
    try {
      if (synthetic) { const r = await S.requestCode(email.trim()); stage = "code"; if (r?.dev_only_code) code = r.dev_only_code; status = "Sandbox account: the code is filled in for you."; }
      else if (links === false) { globalThis.location.assign(S.ACCESS_HREF); return; }
      else { const r = await S.emailLink(email.trim()); minutes = Number(r?.expires_in_minutes) || 30; stage = "sent"; }
    } catch (err) { status = err?.message || "The sign-in link could not be sent. Try again."; }
    finally { busy = false; }
  }
  async function redeem(e) {
    e.preventDefault(); busy = true; status = "";
    try { await S.redeemCode(email.trim(), code.trim()); onsignedin?.(); }
    catch (err) { status = err?.message || "That code did not work."; }
    finally { busy = false; }
  }
</script>

{#snippet top()}{#if phone}<PhoneHeader state="root" signIn={false} home={to("landing")} menuHref={to("menu")} />{:else}<TopBar variant="public" home={to("landing")} />{/if}{/snippet}

<AppShell {phone} {theme} screen {top}>
  <Page width="read" gap={4}>
    <Card hi pad="hero" gap={4}>
      <h1 class="title-phone">Sign in to 3D Review</h1>
      {#if stage === "sent"}
        <p class="lead-16">Check your email — we sent a sign-in link to <strong>{email}</strong>. It works for {minutes} minutes. Open it on this device, then come back to <a class="link" href={to("home")}>your reviews</a>.</p>
        <p class="small">Not there after a minute? Check your Spam or Junk folder. <a class="link" href={to("sign-in")} onclick={(e) => { e.preventDefault(); stage = "email"; }}>Use a different email</a></p>
      {:else if stage === "code"}
        <form onsubmit={redeem}>
          <Stack gap={3}>
            <p class="small t-15">Sandbox sign-in for <strong>{email}</strong>.</p>
            <div><label class="lbl" for="si-code">Code</label><input class="in kbd" id="si-code" inputmode="numeric" autocomplete="one-time-code" placeholder="000 000" value={code} oninput={(e) => (code = e.currentTarget.value)} /></div>
            {#if status}<p class="small" role="status">{status}</p>{/if}
            <Row gap={2}><button class="btn btn-primary" type="submit" disabled={busy || !code.trim()}>{busy ? "Signing in…" : "Sign in"}</button></Row>
          </Stack>
        </form>
      {:else}
        <form onsubmit={sendLink}>
          <Stack gap={3}>
            <p class="small t-15">{links === false ? "Sign in on the Access page; you come back here signed in." : "No password. We email you a link that signs you in. New here? Signing in with your email creates your account."}</p>
            <div><label class="lbl" for="si-email">Email</label><input class="in" id="si-email" type="email" inputmode="email" autocomplete="email" required maxlength="254" value={email} oninput={(e) => (email = e.currentTarget.value)} /></div>
            {#if status}<p class="small field-error" role="alert">{status}</p>{/if}
            <Row gap={2}><button class="btn btn-primary" type="submit" disabled={busy || !email.trim() || (links === undefined && !synthetic)}>{busy ? "Sending…" : synthetic ? "Get a sandbox code" : links === false ? "Go to sign-in" : "Email me a sign-in link"}</button><a class="btn btn-quiet" href="/v2/auth/access" data-code-signin>Sign in with a code instead</a></Row>
          </Stack>
        </form>
      {/if}
      <p class="small"><a class="link" href={to("p-code")}>Have a survey code instead?</a> · <a class="link" href={to("about")}>Why 3D Review exists</a></p>
    </Card>
  </Page>
</AppShell>
