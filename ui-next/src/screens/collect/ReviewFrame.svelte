<!-- UI Next (v4) collect lane review frame. Status: provisional (playbook rule 12). The review page chrome the Collect, CloseCollection
     and PrintQR boards share (generator gen.py review_head + review_tabs; boards_fphone.py collect head + tabs):
     desktop  AppShell > TopBar (crumb: project › review) > Page > [head Row: title + stage pill + meta | ⋯ menu + Share] > stage tabs > body;
     phone    AppShell > PhoneHeader root > [project link, title + pill + ⋯] > stage tabs > body, the PhoneBar slot holds Share.
     shareKind: "primary" (Collect: the page's one primary) or "secondary" (a dialog or sheet holds the primary). menuOpen draws the
     desktop ⋯ menu open (CollectMenu). phoneTitle swaps the root phone header for the nested one (back · title · avatar, PrintQRPhone);
     phoneBar replaces the Share bar (PrintQRPhone: Cancel + Print). Light DOM, contract classes, no <style>, no inline style. Lane variant of the shared parts: the shared
     PhoneBar takes a plus/arrow lead only, so the phone bar here is the same markup with the board's QR lead. Links: shared screens/href.js
     (carries ?w= and ?theme=); the phone avatar opens the actions lane's MenuPhone sheet (menu). The ⋯ summary is .btn.btn-icon (44x44
     since the shared type.css summary:not(.btn-icon) fix). -->
<script>
  import AppShell from "../../AppShell.svelte";
  import Page from "../../Page.svelte";
  import Stack from "../../Stack.svelte";
  import Row from "../../Row.svelte";
  import TopBar from "../../TopBar.svelte";
  import PhoneHeader from "../../PhoneHeader.svelte";
  import Button from "../../Button.svelte";
  import Pill from "../../Pill.svelte";
  import Menu from "../../Menu.svelte";
  import Icon from "../../Icon.svelte";
  import Glyph from "./Glyph.svelte";
  import { G } from "./glyphs.js";
  import { stageTabs } from "./model.js";
  import { href } from "../href.js";

  let { m, phone = false, theme = "light", shareKind = "primary", menuOpen = false, phoneTitle, phoneBar, children } = $props();
  if (!["primary", "secondary"].includes(shareKind)) throw new TypeError(`ReviewFrame: shareKind must be primary or secondary, got ${String(shareKind)}`);
  // Stage tabs link to the fanout's screen for each stage (registered names, carried ?w= and ?theme=).
  const tabs = $derived(stageTabs("collect", { prepare: href("setup5"), collect: href("collect"), understand: href("results"), improve: href("next-step") }));
  const r = $derived(m.review);
  const MENU = $derived([
    { label: "Edit details and dates", href: href("setup1"), icon: G.pen },
    { label: "People with access", href: href("people"), icon: G.people },
    { label: "Close collection now", href: href("close-collection"), icon: G.lock },
    { label: "Meeting offline? Print and paper", href: `${href("collect")}#offline`, icon: G.print },
    { kind: "hr" },
    { label: "Delete this review", danger: true, icon: G.x, refused: `Reviews with responses can't be deleted. This one has ${m.answered}.` },
  ]);
</script>

{#snippet more()}<Icon d={G.more} />{/snippet}
{#snippet qr()}<Glyph name="qr" />{/snippet}
{#snippet top()}{#if phone && phoneTitle}<PhoneHeader state="nested" title={phoneTitle} parent="Collect" back={href("collect")} initials={m.user.initials} menuHref={href("menu")} home={href("home")} />{:else if phone}<PhoneHeader state="root" initials={m.user.initials} menuHref={href("menu")} home={href("home")} />{:else}<TopBar who={m.user.first} initials={m.user.initials} workspace={m.workspace} home={href("home")} crumbs={[{ label: m.project.name, href: href("project") }, { label: r.title }]} />{/if}{/snippet}
{#snippet bar()}{#if phone && phoneBar}{@render phoneBar()}{:else if phone}<div class="glass phone-bar" role="group" aria-label="Page actions"><Button label="Share the survey" variant={shareKind} lg block href={href("share")} lead={qr} /></div>{/if}{/snippet}

<AppShell {phone} {theme} screen {top} {bar}>
  {#if phone}
    <Stack gap={1}>
      <a class="link small" href={href("project")}>{m.project.name}</a>
      <div class="l-row" data-gap="2"><h1 class="title-phone" data-grow>{r.title}</h1><Pill stage={r.stage} /><Button icon={more} ariaLabel="More actions" variant="quiet" href={href("collect", { state: "menu" })} /></div>
    </Stack>
    <nav class="glass tabs" aria-label="Review stages">
      {#each tabs as t (t.id)}<a class="tab" href={t.href} aria-current={t.current ? "page" : undefined}>{t.label}</a>{/each}
    </nav>
    {@render children?.()}
  {:else}
    <Page gap={5}>
      <div class="l-row" data-gap="5" data-align="start" data-split>
        <div class="l-stack" data-gap="2" data-grow>
          <Row gap={3}><h1 class="title-page">{r.title}</h1><Pill stage={r.stage} /></Row>
          <p class="small t-15">{m.meta} · Updated {r.updated}</p>
        </div>
        <Row gap={2}>
          <Menu id="review-more" summary={more} summaryClass="btn btn-icon" label="More actions" title="More actions" items={MENU} open={menuOpen} />
          <Button label="Share the survey" variant={shareKind} href={href("share")} lead={qr} />
        </Row>
      </div>
      <nav class="glass tabs" aria-label="Review stages">
        {#each tabs as t (t.id)}<a class="tab" href={t.href} aria-current={t.current ? "page" : undefined}><span class={t.done ? "dot done" : "dot"}>{#if t.done}<Glyph name="check" size={13} />{:else}{t.n}{/if}</span>{t.label}{#if t.current}{" "}<span class="now">Now</span>{/if}</a>{/each}
      </nav>
      {@render children?.()}
    </Page>
  {/if}
</AppShell>
