<!-- UI Next (v4) Help screen ("Help and FAQ"). Status: provisional (playbook rule 12). Explore lane of the screens fanout.
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): Help.dc.html (desktop), HelpPhone.dc.html (phone). Copy: ./help-copy.js, word for word.
     Desktop on the pinned 8.7 Explore-lane rows, as the board composes them: Page > .l-grid[data-tpl=aside-start] (260px sticky glass
     nav.side-nav + article.l-stack.l-measure, 720 measure) > the intro, the row-form Media card (.l-media[data-dir=row]), one .l-section
     per topic (.h2.t-24) and the FAQ as section 2 Disclosures (V-12). Phone: chip nav, then two .l-card[data-pad=rows] cards (the 8.7 phone
     rows card) of V-12 Disclosures: the board still draws details.dd rows, which design-system.md "Disclosure, menu roles" reserves for menus
     (board pass pending), so the rows are details.disc. No <style>, no inline style. Any ?state= renders the one state the boards draw.
     Links through ../href.js (carries ?theme=): feedback and about. The side nav marks the section the address names
     (aria-current="location", updated on hashchange); with no section in the address the reader is at the top, the first topic,
     which is what the board draws.
     One .btn-primary per page: none on desktop (the board draws none); phone "Send app feedback" in the phone-bar. -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Button from "../../Button.svelte";
  import Disclosure from "../../Disclosure.svelte";
  import Icon from "../../Icon.svelte";
  import { I } from "../../icons.js";
  import { E } from "./icons.js";
  import { href } from "../href.js";
  import { INTRO, VIDEO, TOPICS, FAQ, FAQ_TITLE } from "./help-copy.js";

  let { phone = false, theme = "light" } = $props();
  const W = $derived({ w: phone ? "phone" : null });
  const HOME = $derived(href("home", W)), FEEDBACK = $derived(href("feedback", W)), ABOUT = $derived(href("about", W));
  const [FAQ_ID, FAQ_HEAD] = FAQ_TITLE;
  const NAV = [...TOPICS.map(([id, title]) => [id, title]), [FAQ_ID, FAQ_HEAD]];
  const VIDEO_LINE = `${VIDEO.title} · ${VIDEO.duration}`;
  const hash = () => globalThis.location?.hash?.slice(1) ?? ""; // section ids are plain (h1…h8): no decoding, nothing to throw
  let here = $state(hash());
  const current = $derived(NAV.some(([id]) => id === here) ? here : NAV[0][0]);
  // Attachment on the side nav: follow the address while the nav is on the page.
  const follow = () => {
    const on = () => { here = hash(); };
    globalThis.addEventListener("hashchange", on);
    return () => globalThis.removeEventListener("hashchange", on);
  };
</script>

{#snippet pen()}<Icon d={E.pen} />{/snippet}
{#snippet top()}{#if phone}<PhoneHeader state="nested" title="Help and FAQ" parent="Home" back={HOME} />{:else}<TopBar home={HOME} />{/if}{/snippet}
{#snippet bar()}{#if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Send app feedback" variant="primary" lg block href={FEEDBACK} lead={pen} /></div>{/if}{/snippet}
{#snippet rows(items, label)}<section class="glass l-card" data-pad="rows" aria-label={label}>{#each items as [id, title, text, open]}<div {id}><Disclosure label={title} {open} solid={false}><p class="small">{text}</p></Disclosure></div>{/each}</section>{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <h1 class="title-phone">Help and FAQ</h1>
    <nav class="l-row" data-wrap data-gap="2" aria-label="Help sections">{#each NAV as [id, title]}<a class="chip" href={`#${id}`}>{title}</a>{/each}</nav>
    {@render rows(TOPICS.map(([id, title, , text], i) => [id, title, text, i === 0]), "Help topics")}
    <h2 class="micro" id={FAQ_ID}>{FAQ_HEAD} · {FAQ.length}</h2>
    {@render rows(FAQ.map(([q, a]) => [undefined, q, a, false]), FAQ_HEAD)}
    <a class="link" href={ABOUT}>Read why 3D Review exists <Icon d={I.arrow} /></a>
  {:else}
    <Page>
      <div class="l-grid" data-tpl="aside-start" data-gap="7">
        <nav class="glass side-nav" aria-label="Help sections" {@attach follow}>{#each NAV as [id, title]}<a class="link" href={`#${id}`} aria-current={id === current ? "location" : undefined}>{title}</a>{/each}</nav>
        <article class="l-stack l-measure" data-gap="6">
          <div>
            <h1 class="title-page">Help and FAQ</h1>
            <p class="small body-16">{INTRO}</p>
          </div>
          <div class="glass-hi l-media" data-dir="row" role="group" aria-label={VIDEO_LINE}>
            <div class="l-media-frame"><Icon d={I.play} /></div>
            <div><div class="h3">{VIDEO_LINE}</div><p class="small">{VIDEO.also}</p></div>
          </div>
          {#each TOPICS as [id, title, runs]}
            <section class="l-section" id={id}>
              <h2 class="h2 t-24">{title}</h2>
              <p class="small body-16">{#each runs as run, i}{#if i % 2}<strong>{run}</strong>{:else}{run}{/if}{/each}</p>
            </section>
          {/each}
          <section class="l-section" id={FAQ_ID}>
            <h2 class="h2 t-24">{FAQ_HEAD}</h2>
            {#each FAQ as [q, a]}<Disclosure label={q}><p class="small t-15">{a}</p></Disclosure>{/each}
          </section>
          <p class="small">Still stuck? <a class="link" href={FEEDBACK}>Send app feedback</a>, or read <a class="link" href={ABOUT}>why 3D Review exists</a>.</p>
        </article>
      </div>
    </Page>
  {/if}
</AppShell>
