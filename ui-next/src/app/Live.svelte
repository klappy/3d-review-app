<!-- UI Next (v4) live root. Status: provisional (playbook rule 12; cookbook work/active/2026-10-21-ui-next-demo-wiring).
     Mounted at /next/ for normal use: the hash is the route (app/router.js), every link is an in-app link, back/forward, reload and
     deep links work, and every screen reads the production stores through app/{session,data,participant}.js. Loading, empty, error
     and retry states are drawn here once; the lane screens draw the data. Screens with no live store yet are drawn from their fixture
     and labelled as a preview (never hidden): the receipt lists them. -->
<script>
  import { onMount } from "svelte";
  import { parse, to } from "./router.js";
  import { setLiveContext } from "../screens/href.js";
  import { PHONE_QUERY } from "../route.js";
  import * as S from "./session.js";
  import * as D from "./data.js";
  import * as P from "./participant.js";
  import { classify } from "./api.js";
  import { REGISTRY } from "../screens/registry.js";
  import About from "../screens/About.svelte";
  import Landing from "../screens/Landing.svelte";
  import HomeLive from "./HomeLive.svelte";
  import ProjectLive from "./ProjectLive.svelte";
  import ReviewLive from "./ReviewLive.svelte";
  import SignInLive from "./SignInLive.svelte";
  import Status from "./Status.svelte";
  import { collectModel as collectView } from "../screens/collect/model.js";

  let hash = $state(globalThis.location?.hash ?? "");
  let phone = $state(typeof matchMedia === "function" ? matchMedia(PHONE_QUERY).matches : false);
  const route = $derived(parse(hash));
  const theme = $derived(route.query.get("theme") === "dark" ? "dark" : "light");
  let session = $state(undefined); // undefined = not read yet; null = signed out
  let page = $state({ status: "loading", key: "", data: null, error: null });
  let pstate = $state(P.snapshot()); // participant journey snapshot
  let seq = 0;
  const go = (h) => { if (globalThis.location.hash !== h) globalThis.location.hash = h; else load(); };
  const replace = (h) => { history.replaceState(null, "", globalThis.location.pathname + globalThis.location.search + h); hash = h; };

  onMount(() => {
    const onHash = () => { hash = globalThis.location.hash; };
    globalThis.addEventListener("hashchange", onHash);
    const mq = typeof matchMedia === "function" ? matchMedia(PHONE_QUERY) : null;
    const onMq = () => { phone = mq.matches; };
    mq?.addEventListener("change", onMq);
    const off = P.subscribe((s) => { pstate = s; });
    return () => { globalThis.removeEventListener("hashchange", onHash); mq?.removeEventListener("change", onMq); off(); };
  });

  const PARTICIPANT = new Set(["p-entry", "p-code", "p-welcome", "p-passage", "p-about", "p-question", "p-review", "p-receipt", "p-problem"]);
  const PUBLIC = new Set(["landing", "about", "sign-in", "sign-in-check", "help", "feedback"]);
  // Which route needs which data. Every loader resolves to the props its screen takes.
  async function loader(r) {
    const { name, params } = r;
    if (PARTICIPANT.has(name)) return participant(r);
    if (name === "home") { const me = await S.me(); if (!me) return { screen: "landing" }; return { screen: "home", home: await D.homeModel(me) }; }
    if (name === "landing" || name === "about" || name === "help" || name === "feedback") return { screen: name };
    if (name === "sign-in" || name === "sign-in-check") { const me = await S.me(); return me ? { redirect: to("home") } : { screen: "sign-in" }; }
    const me = await S.me();
    if (!me) return { screen: "sign-in", next: hash };
    if (name === "workspaces" || name === "workspace" || name === "people" || name === "people-workspace" || name === "invitations" || name === "explore" || name === "setup") return { screen: "home", home: await D.homeModel(me), note: name };
    if (name === "project") { const [p, as] = await Promise.all([D.project(params.pid), D.assessmentsOf(params.pid)]); return { screen: "project", project: p, assessments: as }; }
    if (name === "review") { const { assessment, surveys } = await D.assessment(params.aid); const p = await D.project(assessment.project_id).catch(() => null); return { screen: "review", assessment, surveys, project: p }; }
    if (name === "collect" || name === "close-collection") { const m = await D.collectModel(params.aid); return { screen: name, data: m }; }
    if (name === "qr-room" || name === "print-qr") {
      const m = await D.collectModel(params.aid);
      const open = m.groups.flatMap((g) => g.surveys).filter((s) => s.open);
      await Promise.all(open.map(async (s) => { try { const l = await D.linkFor(params.aid, s.id); s.link = `${m.origin}/next/${l.fragment}`; s.qr = D.qrModules(s.link).cells; s.code = s.id; } catch (e) { s.linkError = e.message; } }));
      m.groups = m.groups.map((g) => ({ ...g, surveys: g.surveys.filter((s) => s.qr) })).filter((g) => g.surveys.length);
      return { screen: name, data: m, empty: !m.groups.length, emptyText: open.length ? "The survey links could not be created. Try again." : "No survey is collecting yet. Open collection on the review page first." };
    }
    if (name.startsWith("results") || name.startsWith("report")) {
      const m = await D.resultsModel(params.aid, { build: name !== "results-held" });
      return { screen: name, results: m };
    }
    if (name === "next-step" || name === "action-plan" || name === "share" || name === "print" || name === "paper-entry" || name === "sandbox" || name === "menu") {
      const { assessment } = params.aid ? await D.assessment(params.aid) : { assessment: null };
      return { screen: name, preview: true, assessment };
    }
    return { redirect: to("home") };
  }
  async function participant(r) {
    const { name, query } = r;
    if (name === "p-entry") { await P.start(); const [s, q] = P.screenFor(P.state()); replace(to(s ?? "p-code", {}, q)); return { screen: null }; }
    if (name === "p-code") return { screen: "p-code" };
    if (!P.state() || P.state().phase === "opening") {
      if (!P.state() && !P.hasSession()) return { redirect: to("p-code") };
      await P.start(); // joins an open already in flight (a route change while the link opens)
    }
    const st = P.state();
    const [land, q] = P.screenFor(st);
    // A screen the journey cannot show in this phase (receipt reached, link gone) lands where the phase says.
    const formScreens = new Set(["p-welcome", "p-passage", "p-about", "p-question", "p-review"]);
    if (st.phase === "unavailable" && name !== "p-problem") return { redirect: to(land, {}, q) };
    if (st.phase === "receipt" && name !== "p-receipt") return { redirect: to("p-receipt") };
    if (st.phase === "review" && formScreens.has(name) && name !== "p-review") P.editAnswers();
    if (st.phase === "form" && name === "p-review") P.toReview();
    return { screen: name, q: query };
  }
  async function load() {
    const my = ++seq;
    const r = route;
    setLiveContext({ ...r.params });
    // The loading screen shows only when a read takes longer than a blink, so walking questions never flashes.
    const slow = setTimeout(() => { if (my === seq) page = { status: "loading", key: r.name, data: null, error: null }; }, 180);
    try {
      const data = await loader(r);
      clearTimeout(slow);
      if (my !== seq) return;
      if (data.redirect) { replace(data.redirect); return; }
      if (data.screen === null) return;
      page = { status: "ready", key: r.name, data, error: null };
    } catch (e) {
      clearTimeout(slow);
      if (my !== seq) return;
      const kind = classify(e);
      if (kind === "unauthenticated") { S.forget(); page = { status: "ready", key: r.name, data: { screen: "sign-in", next: hash }, error: null }; return; }
      page = { status: "error", key: r.name, data: null, error: { kind, message: String(e?.message || "Request could not be completed.") } };
    }
  }
  $effect(() => { void route; load(); });
  $effect(() => { if (session === undefined) S.me().then((m) => { session = m; }).catch(() => { session = null; }); });

  // Participant actions (the journey owns persistence; these only navigate on its answer).
  let busy = $state(false), codeError = $state("");
  const land = () => { const [s, q] = P.screenFor(P.state()); go(to(s ?? "p-code", {}, q)); };
  async function redeem(code) {
    busy = true; codeError = "";
    const r = await P.redeem(code);
    busy = false;
    if (r.ok) { await P.start(); land(); return; }
    if (r.busy) { go(to("p-problem", {}, { state: "busy" })); return; }
    codeError = r.error;
  }
  let gaps = $state([]);
  async function send() { busy = true; gaps = []; try { const r = await P.submit(); if (r?.missing) { gaps = r.missing; return; } } finally { busy = false; } land(); }
  async function another() { busy = true; try { await P.another(); } finally { busy = false; } land(); }
  async function retry() { busy = true; try { if (P.state()?.phase === "review") await P.submit(); else await P.start({ retry: true }); } finally { busy = false; } land(); }
  const q = $derived(route.params.n);
  const pm = $derived(pstate.model);

  // Signed-in chrome for the live screens.
  const who = $derived(session ? { first: S.firstName(session.principal), initials: S.initialsOf(session.principal) } : null);
  async function signOut() { await S.signOut(); session = null; go(to("landing")); }
  const accountItems = $derived(session ? [
    { kind: "head", label: session.principal?.display_name || "Signed in", sub: session.principal?.id ? "Facilitator" : "" }, { kind: "hr" },
    { label: "Help and FAQ", href: to("help") }, { label: "Why 3D Review exists", href: to("about") }, { label: "Send app feedback", href: to("feedback") },
    { label: "Current design", href: "/" }, { kind: "hr" }, { label: "Sign out", onclick: signOut },
  ] : []);
  function onSignedIn() { S.forget(); session = undefined; const next = page.data?.next; go(next && next !== "#/signin" ? next : to("home")); }
  async function refreshResults() {
    const r = route;
    try { const out = await D.buildReport(r.params.aid); if (out.held) page = { ...page, data: { ...page.data, refreshed: "The results can’t be rebuilt yet: more answers are needed." } }; else load(); }
    catch (e) { page = { ...page, data: { ...page.data, refreshed: `Could not rebuild: ${e?.message || "try again"}` } }; }
  }
  async function moveStage(stage) { await D.setStage(route.params.aid, stage); load(); }
  const chrome = $derived({ phone, theme, who, accountItems, session });
  const reportFor = (m) => (m.payload ? { review: m.review, counts: m.counts, payload: m.payload, gaps: D.gapsOf(m.payload), radar: D.radarOf(m.payload), lookNext: [] } : null);
</script>

{#if page.status === "loading"}
  <Status {phone} {theme} kind="loading" />
{:else if page.status === "error"}
  <Status {phone} {theme} kind={page.error.kind} message={page.error.message} onretry={load} />
{:else if page.data.screen === "landing"}
  <Landing {phone} {theme} />
{:else if page.data.screen === "about"}
  <About {phone} {theme} />
{:else if page.data.screen === "sign-in"}
  <SignInLive {phone} {theme} onsignedin={onSignedIn} />
{:else if page.data.screen === "help" || page.data.screen === "feedback"}
  {@const C = REGISTRY[page.data.screen]}
  <C {phone} {theme} />
{:else if page.data.screen === "home"}
  <HomeLive {phone} {theme} {chrome} home={page.data.home} note={page.data.note} />
{:else if page.data.screen === "project"}
  <ProjectLive {phone} {theme} {chrome} project={page.data.project} assessments={page.data.assessments} />
{:else if page.data.screen === "review"}
  <ReviewLive {phone} {theme} {chrome} assessment={page.data.assessment} surveys={page.data.surveys} project={page.data.project} onstage={moveStage} />
{:else if page.data.screen === "collect" || page.data.screen === "close-collection" || page.data.screen === "qr-room" || page.data.screen === "print-qr"}
  {#if page.data.empty}
    <Status {phone} {theme} kind="empty" message={page.data.emptyText} back={to("review", route.params)} backLabel="Back to the review" onretry={load} />
  {:else}
    {@const C = REGISTRY[page.data.screen]}
    <C {phone} {theme} data={page.data.data} state={route.query.get("state") ?? undefined} />
  {/if}
{:else if page.data.screen === "results" || page.data.screen === "results-gaps" || page.data.screen === "results-answers" || page.data.screen === "report" || page.data.screen === "report-detailed" || page.data.screen === "results-held"}
  {@const m = page.data.results}
  {@const rep = reportFor(m)}
  {#if !rep || page.data.screen === "results-held"}
    {@const Held = REGISTRY["results-held"]}
    <Held {phone} {theme} report={{ review: m.review, counts: m.counts, payload: m.payload ?? { lenses: [] } }} />
  {:else if page.data.screen === "results-answers"}
    {@const C = REGISTRY["results-answers"]}
    <Status {phone} {theme} kind="preview" message="The answer-by-answer view is a design preview: the numbers below are sample data, not this review's answers." inline />
    <C {phone} {theme} report={rep} state={route.query.get("state") ?? undefined} />
  {:else if page.data.screen === "results"}
    {@const C = REGISTRY.results}
    <C {phone} {theme} report={rep} onrefresh={refreshResults} refreshed={page.data.refreshed ?? ""} />
  {:else}
    {@const C = REGISTRY[page.data.screen]}
    <C {phone} {theme} report={rep} />
  {/if}
{:else if page.data.preview}
  {@const C = REGISTRY[page.data.screen]}
  <Status {phone} {theme} kind="preview" message={`This screen is a design preview with sample data${page.data.assessment ? ` (your review: ${page.data.assessment.name})` : ""}. The current design still does this for real.`} inline back={page.data.assessment ? to("review", route.params) : to("home")} backLabel={page.data.assessment ? "Back to the review" : "Home"} />
  <C {phone} {theme} state={route.query.get("state") ?? undefined} />
{:else if page.data.screen === "p-code"}
  {@const C = REGISTRY["p-code"]}
  <C phone={true} {theme} onredeem={redeem} message={codeError} {busy} state={codeError ? "error" : undefined} />
{:else if pm}
  {#if page.data.screen === "p-welcome"}{@const C = REGISTRY["p-welcome"]}<C phone={true} {theme} d={pm} />
  {:else if page.data.screen === "p-passage"}{@const C = REGISTRY["p-passage"]}<C phone={true} {theme} d={pm} />
  {:else if page.data.screen === "p-about"}{@const C = REGISTRY["p-about"]}<C phone={true} {theme} d={pm} onabout={P.setAbout} />
  {:else if page.data.screen === "p-question"}{@const C = REGISTRY["p-question"]}{#key q}<C phone={true} {theme} d={pm} {q} onanswer={P.answer} />{/key}
  {:else if page.data.screen === "p-review"}{@const C = REGISTRY["p-review"]}<C phone={true} {theme} d={pm} onsend={send} {busy} notice={gaps.length ? `${gaps.length === 1 ? "One question still needs an answer" : `${gaps.length} questions still need an answer`} before you send: ${gaps.map((g) => g.n).join(", ")}.` : pm.notice} missing={gaps} />
  {:else if page.data.screen === "p-receipt"}{@const C = REGISTRY["p-receipt"]}<C phone={true} {theme} d={pm} onanother={another} notice={pm.notice} />
  {:else if page.data.screen === "p-problem"}{@const C = REGISTRY["p-problem"]}<C phone={true} {theme} d={pm} onretry={retry} state={route.query.get("state") ?? undefined} />
  {/if}
{:else}
  <Status {phone} {theme} kind="empty" message="Open your survey link, or enter your code." back={to("p-code")} backLabel="Enter a code" />
{/if}
