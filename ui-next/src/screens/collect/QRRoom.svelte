<!-- UI Next (v4) QR room screen ("Room view"). Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/collect/collect.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): QRRoom.dc.html (projector: one code per survey, grouped by perspective
     colour), QRRoomPhone.dc.html (phone: one survey at a time, Previous / Next survey; ?state=<n> picks the survey, 1-based, default the
     board's 3 of 5). Contracts: §2 Perspective card (accent bar from [data-lens]), §1.4 QR room pill, Room health row (ruling 8: the
     instruction is addressed to the room under the codes on the projector), §2 Offline actions (one pointer, never its own print button).
     One .btn-primary on phone ("Next survey", the phone bar); the projector draws none (nothing on a projected screen is for the audience
     to press). The codes are the boards' placeholders (fixture); a real link draws through ui/assess/vendor-qrcode.js (model.js qrModules). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import LensDot from "../../LensDot.svelte";
  import RoomTop from "./RoomTop.svelte";
  import RoomHealth from "./RoomHealth.svelte";
  import Glyph from "./Glyph.svelte";
  import Qr from "./Qr.svelte";
  import { collectModel, href } from "./model.js";
  import fixture from "../../../fixtures/collect/collect.json";

  let { phone = false, theme = "light", state, data = fixture } = $props();
  const m = $derived(collectModel(data));
  const pick = (st, total, dflt) => {
    if (st === undefined) return dflt;
    const k = Number(st);
    if (!Number.isInteger(k) || k < 1 || k > total) throw new TypeError(`QRRoom: state is the survey number 1..${total}, got "${String(st)}"`);
    return k - 1;
  };
  const at = $derived(pick(state, m.surveys.length, data.qrRoomPhone.survey));
  if (!phone && state !== undefined) throw new TypeError("QRRoom: the projector board draws every survey at once (no state)");
  const s = $derived(m.surveys[at]);
  const one = $derived(at === data.qrRoomPhone.survey ? data.qrRoomPhone : { link: s.link, qr: s.qr, language: data.qrRoomPhone.language });
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Show a QR code" parent="Collect" back={href("collect", { phone: true })} initials={m.user.initials} menuHref={href("menu-phone", { phone: true })} />{:else}<RoomTop {m} />{/if}{/snippet}
{#snippet back()}<Glyph name="back" />{/snippet}
{#snippet arrow()}<Glyph name="arrow" />{/snippet}
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Previous" variant="quiet" href={href("qr-room", { phone: true, state: String(((at + m.surveys.length - 1) % m.surveys.length) + 1) })} lead={back} /><Button label="Next survey" variant="primary" lg href={href("qr-room", { phone: true, state: String(((at + 1) % m.surveys.length) + 1) })} trail={arrow} /></div>{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <Row split gap={3}><span class="micro">Survey {at + 1} of {m.surveys.length}</span><a class="link small" href={href("collect", { phone: true, hash: "offline" })}>Meeting offline? Print and paper</a></Row>
    <div class="glass-hi l-card l-stack" data-pad="hero" data-gap="4" data-align="center">
      <div class="l-row" data-gap="2"><LensDot lens={s.lens} decorative /><span class="h2">{s.name}</span></div>
      <Qr cells={one.qr} size="phone" />
      <p class="small">Scan to open the {one.language} survey<br /><b>{one.link}</b></p>
    </div>
    <RoomHealth opened={m.room.desktop.opened} refused={m.room.desktop.refused} wrap />
  {:else}
    <Page gap={6}>
      <div class="l-stack" data-gap="2" data-align="center">
        <h1 class="display display-tight">Scan the code for your role</h1>
        <p class="small lead">Find your perspective's colour, then the survey for your role. No account, no name.</p>
      </div>
      <div class="l-grid" data-gap="5" data-cols="4">
        {#each m.surveys as c (c.code)}
          <div class="glass-hi l-card l-stack" data-lens={c.lens} data-pad="hero" data-gap="3" data-align="center">
            <span class="lvl-pair"><LensDot lens={c.lens} decorative />{m.groups.find((g) => g.lens === c.lens).label}</span>
            <Qr cells={c.qr} size="room" />
            <span class="h2">{c.room}</span>
            <span class="kbd">{c.link}</span>
          </div>
        {/each}
      </div>
      <div class="l-stack" data-gap="2" data-align="center">
        <p class="small lead">Not sure which is yours? Ask the facilitator. No phone? Ask for a paper survey.</p>
        {#if m.room.desktop.refused}<p class="small lead">Survey not opening? Switch from the shared Wi-Fi to mobile data, or ask for a paper survey.</p>{/if}
      </div>
    </Page>
  {/if}
</AppShell>
