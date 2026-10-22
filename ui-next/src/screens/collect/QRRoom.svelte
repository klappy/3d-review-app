<!-- UI Next (v4) QR room screen ("Room view"). Status: provisional (playbook rule 12). Mock data: ui-next/fixtures/collect/collect.json.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): QRRoom.dc.html (projector: one code per survey, grouped by perspective
     colour), QRRoomPhone.dc.html (phone: one survey at a time, Previous / Next survey; ?state=<n> picks the survey, 1-based; absent or not
     a survey number, the board's 3 of 5; a data row without the qrRoomPhone default starts on the first survey). Contracts: §2 Perspective card (accent bar from [data-lens]), §1.4 QR room pill, Room health row
     (ruling 8: the instruction is addressed to the room under the codes on the projector), §2 Offline actions (one pointer, never its own
     print button). Projector: five tiles across (.l-grid[data-cols="5"], gap --sp-4) so every code and the room lines sit above the fold at
     1280x800; each code keeps the §8.7 room size (176) and centres into its tile's hero padding (the board's 18/16/20 projector tile padding
     is a row owed). Phone: the survey name is the page's h1.
     One .btn-primary on phone ("Next survey", the phone bar); the projector draws none (nothing on a projected screen is for the audience
     to press). Each survey's link and code come from its own row (one source); the room counts from the one room.
     The default survey is clamped to the surveys there are (model.js pickSurvey); a review with no surveys draws "No surveys yet" as its
     h1 and no pager. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Row from "../../Row.svelte";
  import Button from "../../Button.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import LensDot from "../../LensDot.svelte";
  import RoomTop from "./RoomTop.svelte";
  import Glyph from "./Glyph.svelte";
  import Qr from "./Qr.svelte";
  import { collectModel, pickSurvey } from "./model.js";
  import { href } from "../href.js";
  import fixture from "../../../fixtures/collect/collect.json";

  let { phone = false, theme = "light", state, data = fixture } = $props();
  const m = $derived(collectModel(data));
  const total = $derived(m.surveys.length);
  const at = $derived(pickSurvey(state, total, data.qrRoomPhone?.survey));
  const s = $derived(at < 0 ? undefined : m.surveys[at]);
</script>

{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Show a QR code" parent="Collect" back={href("collect")} initials={m.user.initials} menuHref={href("menu")} home={href("home")} />{:else}<RoomTop {m} />{/if}{/snippet}
{#snippet back()}<Glyph name="back" />{/snippet}
{#snippet arrow()}<Glyph name="arrow" />{/snippet}
{#snippet bar()}{#if phone && s}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Previous" variant="quiet" href={href("qr-room", { state: String(((at + total - 1) % total) + 1) })} lead={back} /><Button label="Next survey" variant="primary" lg href={href("qr-room", { state: String(((at + 1) % total) + 1) })} trail={arrow} /></div>{/if}{/snippet}

<AppShell {phone} {theme} screen rhythm={phone ? undefined : "center"} {top} {bar}>
  {#if phone}
    <Row split gap={3}><span class="micro">{#if s}Survey {at + 1} of {total}{/if}</span><a class="link small" href={`${href("collect")}#offline`}>Meeting offline? Print and paper</a></Row>
    <div class="glass-hi l-card l-stack" data-pad="hero" data-gap="4" data-align="center">
      {#if s}
        <div class="l-row" data-gap="2"><LensDot lens={s.lens} decorative /><h1 class="h2">{s.name}</h1></div>
        <Qr cells={s.qr} size="phone" />
        <p class="small">Scan to open the {m.review.language} survey<br /><b>{s.link}</b></p>
      {:else}
        <h1 class="h2">No surveys yet</h1>
      {/if}
    </div>
  {:else}
    <Page gap={6}>
      <div class="l-stack" data-gap="2" data-align="center">
        <h1 class="display display-tight">Scan the code for your role</h1>
        <p class="small lead">Find your perspective's colour, then the survey for your role. No account, no name.</p>
      </div>
      <div class="l-grid" data-gap="4" data-cols="5">
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
        
      </div>
    </Page>
  {/if}
</AppShell>
