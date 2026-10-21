<!-- UI Next (v4) facilitator sign-in: magic link, one field (step "email"), then "Check your email" with the code fallback (step "check").
     Status: provisional (playbook rule 12). Boards (cookbook design/2026-10-15-glass-redesign/canvas): SignInPhone.dc.html (email, phone),
     SignInCheck.dc.html + SignInCheckPhone.dc.html (check; screen sign-in-check via SignInCheck.svelte). No desktop board draws the email
     step (SignInPhone's provenance names the Main board); the desktop email step reuses SignInCheck's card shape, flagged in RESULTS-people.
     Composed of AppShell > Page > Card / Row and the section 2 components; no <style>, no inline style. The code fallback is the
     section 2 Disclosure (details.disc): the boards draw a bare <details> with a .link summary and inline list-style/min-height/flex
     (rule 16 debt; not .dd, which means a menu). One .btn-primary per page: desktop
     inside the card ("Email me a sign-in link" / "I've opened the link"); phone in the phone-bar. Data: ui-next/fixtures/people/sign-in.json. -->
<script module>
  export const STEPS = Object.freeze(["email", "check"]);
</script>
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Card from "../../Card.svelte";
  import Row from "../../Row.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import PhoneBar from "../../PhoneBar.svelte";
  import Button from "../../Button.svelte";
  import Disclosure from "../../Disclosure.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import d from "../../../fixtures/people/sign-in.json";

  let { step = "email", phone = false, theme = "light", state } = $props();
  if (!STEPS.includes(step)) throw new TypeError(`SignIn: unknown step "${String(step)}" (email | check)`);
  if (state !== undefined) throw new TypeError(`SignIn: no board draws state "${String(state)}"`);
  const w = phone ? "&w=phone" : "";
  const HOME = `?screen=home${w}`, AGAIN = `?screen=sign-in${w}`, CHECK = `?screen=sign-in-check${w}`;
  const email = phone ? d.email.phone : d.email.desktop;
  const check = step === "check";
  const CODE = "Link not working? Use the 6-digit code instead";
</script>

{#snippet mail()}<Icon d={I.mail} />{/snippet}
{#snippet arrow()}<Icon d={I.arrow} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="public" signIn={false} home="?screen=landing&w=phone" />{/if}{/snippet}
{#snippet bar()}{#if phone}{#if check}<PhoneBar label="I've opened the link" href={HOME} />{:else}<PhoneBar label="Email me a sign-in link" href={CHECK} />{/if}{/if}{/snippet}
{#snippet badge()}<span class="icn icn-lens" data-lens="team" aria-hidden="true"><Icon d={I.mail} /></span>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    {#if check}
      <Card hi pad="hero" gap={4} label="Check your email">
        {@render badge()}
        <h1 class="title-phone">Check your email</h1>
        <p class="small">We sent a link to <b>{email}</b>. Open it on this phone to sign in.</p>
        <Disclosure label={CODE} solid={false} gap={3}>
          <Row gap={2}><input class="in" aria-label="6-digit code" inputmode="numeric" autocomplete="one-time-code" /><Button label="Sign in" href={HOME} /></Row>
        </Disclosure>
        <p class="small"><a class="link" href={AGAIN}>Send it again</a> · <a class="link" href={AGAIN}>Use a different email</a></p>
      </Card>
    {:else}
      <Card hi pad="hero" gap={4} label="Sign in">
        <h1 class="title-phone">Sign in</h1>
        <p class="small">We email you a link. No password to remember.</p>
        <div><label class="lbl" for="si-email">Email</label><input class="in" id="si-email" type="email" value={email} inputmode="email" autocomplete="email" /></div>
        <p class="small">Answering a survey? <a class="link" href="#survey-code">enter your code</a> instead.</p>
      </Card>
      <p class="small"><a class="link" href="?screen=landing&w=phone">Read about 3D Review</a> · <a class="link" href="#results">open the sample review</a></p>
    {/if}
  {:else}
    <Page width="read">
      {#if check}
        <Card hi gap={5} label="Check your email">
          {@render badge()}
          <h1 class="h1">Check your email</h1>
          <p class="small body-16">We sent a sign-in link to <strong>{email}</strong>. It works for {d.minutes} minutes. Check your spam folder if it is slow.</p>
          <Row><Button label="I've opened the link" variant="primary" lg href={HOME} trail={arrow} /></Row>
          <Disclosure label={CODE} solid={false} gap={3}>
            <Row gap={3}><div><label class="lbl" for="si-code">Code from the email</label><input class="in kbd" id="si-code" inputmode="numeric" autocomplete="one-time-code" placeholder="000 000" /></div><Button label="Sign in" href={HOME} /></Row>
            <p class="small">Some browsers submit a pasted code on their own. If you see an error, open the link once more.</p>
          </Disclosure>
          <p class="small">Nothing arrived? <a class="link" href={AGAIN}>Send it again</a> · <a class="link" href={AGAIN}>Use a different email</a></p>
        </Card>
      {:else}
        <Card hi gap={5} label="Sign in">
          <h1 class="h1">Sign in</h1>
          <p class="small body-16">We email you a link. No password to remember.</p>
          <div><label class="lbl" for="si-email">Email</label><input class="in" id="si-email" type="email" value={email} inputmode="email" autocomplete="email" /></div>
          <Row><Button label="Email me a sign-in link" variant="primary" lg href={CHECK} lead={mail} /></Row>
          <p class="small">Answering a survey? <a class="link" href="#survey-code">enter your code</a> instead.</p>
          <p class="small"><a class="link" href="?screen=landing">Read about 3D Review</a> · <a class="link" href="#results">open the sample review</a></p>
        </Card>
      {/if}
    </Page>
  {/if}
</AppShell>
