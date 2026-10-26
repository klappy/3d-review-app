<!-- UI Next (v4) live root. Status: provisional (playbook rule 12; cookbook work/active/2026-10-21-ui-next-demo-wiring).
     Mounted at /next/ for normal use: the hash is the route (app/router.js), every link is an in-app link, back/forward, reload and
     deep links work, and every screen reads the production stores through app/{session,data,participant}.js. Loading, empty, error
     and retry states are drawn here once; the lane screens draw the data. Screens with no live store yet are drawn from their fixture
     and labelled as a preview (never hidden): the receipt lists them. -->
<script>
  import { tick } from "svelte";
  import { openQrPrint, preparePapers, openPapersPrint, paperPreview, printReadyLine, printAllowed } from "./print.js";
  import { loadBlankPrint } from "../../../ui/stage-screens.js";
  import { SAMPLE_HREF, SAMPLE_AID } from "./router.js";
  import { REPORT as SAMPLE_REPORT } from "../screens/results/data.js";
  import { api, token } from "./api.js";
  import { onMount } from "svelte";
  import { parse, to } from "./router.js";
  import { setLiveContext, liveContext } from "../screens/href.js";
  import { setLiveChrome } from "./chrome.js";
  import { PHONE_QUERY } from "../route.js";
  import * as S from "./session.js";
  import * as D from "./data.js";
  import * as P from "./participant.js";
  import * as SU from "./setup.js";
  import { sheetSentence } from "../../../ui/assess/permissions.js";
  import { classify } from "./api.js";
  import { REGISTRY } from "../screens/registry.js";
  import About from "../screens/About.svelte";
  import Landing from "../screens/Landing.svelte";
  import Home from "../screens/Home.svelte";
  import SignInLive from "./SignInLive.svelte";
  import Status from "./Status.svelte";
  import { collectModel as collectView } from "../screens/collect/model.js";
  import Card from "../Card.svelte";
  import Row from "../Row.svelte";
  import NotBuilt from "./NotBuilt.svelte";
  import { buildConfirmText } from "../../../ui/assess/report-build.js";

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
  const PUBLIC = new Set(["landing", "about", "sign-in", "sign-in-check", "help", "feedback", "external", "sample"]);
  const SAMPLE = new Set(["results", "results-gaps", "results-answers", "report", "report-detailed", "next-step", "action-plan"]);
  // The sample review (fixture report.json, the boards' data): the results lane renders it read-only with a "Sample data" line; no API.
  const sampleModel = () => { const f = SAMPLE_REPORT.desktop; return { aid: SAMPLE_AID, review: { ...f.review }, counts: f.counts, payload: f.payload, reportId: null, held: null, results: null, serverStage: "understand", canBuild: false, canReadResponses: false, canReopen: false, sample: true }; };
  const SETUP = new Set(["setup", "setup1", "setup2", "setup3", "setup4", "setup5"]);
  // Which route needs which data. Every loader resolves to the props its screen takes.
  async function loader(r) {
    const { name, params } = r;
    if (PARTICIPANT.has(name)) return participant(r);
    if (name === "home") { const me = await S.me(); if (!me) return { screen: "landing" }; const home = await D.homeModel(me); return { screen: "home", home, state: home.empty ? "first" : "reviews" }; }
    if (name === "external") { globalThis.location.assign(params.href); return { screen: null }; } // the sample review in the current design
    // The sample review is a closed world (captain 2026-10-22 10:36 ET: a clickable journey across every screen, nothing live): any
    // route carrying the sample id — review, project, setup ?review=, people ?review= — renders its approved fixture with the
    // "Sample data" line and never calls the API. The results lane keeps its fixture report; everything else draws its own fixture.
    const inSample = params.aid === SAMPLE_AID || params.pid === SAMPLE_AID || params.wid === SAMPLE_AID || route.query.get("review") === SAMPLE_AID;
    if (inSample) setLiveContext({ ...liveContext(), aid: SAMPLE_AID, pid: SAMPLE_AID, wid: SAMPLE_AID }); // every link from a sample screen stays in the sample
    if (inSample && !SAMPLE.has(name)) { if (name === "review") return { redirect: to("setup5", {}, { review: SAMPLE_AID }) }; if (name === "setup") return { redirect: to("setup1", {}, { review: SAMPLE_AID }) }; return { screen: name, sample: true, fixture: true }; }
    if (params.aid === SAMPLE_AID) { if (!SAMPLE.has(name)) return { redirect: to("results", { aid: SAMPLE_AID }) }; const m = sampleModel(); return name === "next-step" || name === "action-plan" ? { screen: name, results: m, plan: D.nextStepModel(m), sample: true } : name === "results-answers" ? { screen: name, results: m, answers: { suppressed: true, reason: "sample data has no answer rows" }, sample: true } : { screen: name, results: m, sample: true }; }
    if (name === "landing" || name === "about" || name === "help") return { screen: name };
    // Feedback posts the existing contract (ui/assess/feedback.js: POST /v2/feedback with require_authenticated); the sample tour and the
    // signed-out see the current UI's sign-in line instead of a form that would be refused.
    if (name === "feedback") { const me = await S.me(); const from = r.query.get("from") ? { page: r.query.get("from"), review: r.query.get("review") ?? "" } : null; return { screen: name, me, allowed: !!me && me.principal?.kind !== "anonymous", from }; }
    // The sample review lives in the current design (ui/demo.js, in-memory demo data): the practice route hands the visitor there, as the
    // lanes' "Try the sample review" link does; no practice-copy store exists to fill a sandbox from.
    if (name === "sandbox") { globalThis.location.assign(SAMPLE_HREF); return { screen: null }; }
    if (name === "sign-in" || name === "sign-in-check") { const me = await S.me(); return me ? { redirect: to("home") } : { screen: "sign-in" }; }
    const me = await S.me();
    if (!me) return { screen: "sign-in", next: hash };
    // Setup: with a review in the query, Setup 5 shows that review's own data (the review page's board while preparing).
    const reviewQ = route.query.get("review");
    if (name === "setup5" && reviewQ) return { screen: "setup5", data: await D.setupModel(reviewQ), readOnly: true };
    // Steps 1–4 edit the review through the existing contracts (app/setup.js, wizard.js order); a bare #setup starts a new review.
    if (["setup", "setup1", "setup2", "setup3", "setup4"].includes(name)) { suSt = await SU.openSetup(reviewQ || null, { pid: route.query.get("project") || liveContext()?.pid || "" }); suError = ""; bump(); const screen = name === "setup" ? "setup1" : name; if (suSt.stage !== "prepare" && screen !== "setup1") return { redirect: to("review", { aid: suSt.aid }) }; /* a launched review edits details and dates only (step 3 could archive a live survey with responses) */ return { screen, step: Number(screen.slice(-1)) }; }
    if (name === "workspaces") return { screen: "home", home: await D.homeModel(me), assessment: null };
    if (name === "setup5") return { redirect: to("home") }; // a review's own page is its Setup 5 while preparing (name === "review")
    // People and workspaces read the live stores (app/data.js): a workspace's grouped projects, a scope's roster (members and owners
    // only: a viewer's refusal is shown as such), the account's own invitations, every review it can see.
    if (name === "explore") return { screen: name, data: await D.exploreModel(me) };
    if (name === "workspace" || name === "workspace-group") return { screen: name, data: await D.workspaceModel(params.wid, me) };
    if (name === "people-workspace") return { screen: name, data: await D.peopleModel({ type: "workspace", id: params.wid }, me) };
    if (name === "people") { if (!reviewQ) return { screen: name, empty: true, emptyText: "Open People from a review's page: this page lists who has access to one review." }; return { screen: name, data: await D.peopleModel({ type: "assessment", id: reviewQ }, me) }; }
    if (name === "invitations") return { screen: name, data: await D.invitationsModel(me) };
    if (name === "project") return { screen: "project", data: await D.projectModel(params.pid) };
    // A review's own page is the board for its stage: Setup 5 (ready to launch) while preparing, Collect while collecting, Results after.
    if (name === "review") { const { assessment } = await D.assessment(params.aid); if (assessment.stage === "collect") return { redirect: to("collect", params) }; if (assessment.stage !== "prepare") return { redirect: to("results", params) }; return { screen: "setup5", data: await D.setupModel(params.aid) }; }
    if (name === "collect" || name === "close-collection") { const m = await D.attachLinks(await D.collectModel(params.aid), { full: true }); return { screen: name, data: m }; }
    if (name === "qr-room" || name === "print-qr") {
      // The room shows the host under each QR: the board's short 3dreview.app/s/CODE has no backend yet (RESULTS-collect debt; parity-loop row).
      const m = await D.attachLinks(await D.collectModel(params.aid), { full: name === "print-qr" });
      const open = m.groups.flatMap((g) => g.surveys).filter((s) => s.open);
      m.groups = m.groups.map((g) => ({ ...g, surveys: g.surveys.filter((s) => s.qr) })).filter((g) => g.surveys.length);
      return { screen: name, data: m, empty: !m.groups.length, emptyText: open.length ? "The survey links could not be created. Try again." : "No survey is collecting yet. Open collection on the review page first." };
    }
    if (name.startsWith("results") || name.startsWith("report")) {
      const m = await D.resultsModel(params.aid, { build: false }); // read-only: a missing report is offered to build, never built on load
      if (name === "results-answers") { const rows = await D.responsesList(params.aid); return { screen: name, results: m, answers: rows }; } // a failed read is the shell's error (retryable), not a policy hold
      return { screen: name, results: m };
    }
    if (name === "share") { const sm = await D.shareModel(params.aid, me); return { screen: "share", shareData: sm.review, share: sm.share }; }
    if (name === "menu") { const home = await D.homeModel(me); return { screen: "menu", menu: D.menuModel(me, home, { onSignOut: signOut }) }; }
    // Print paper surveys for real: the chosen surveys' blank forms through GET /v2/assessments/{aid}/surveys/{sid}/print (app/print.js);
    // the preview sheet is the first ticked survey's form, read now (read-only) so the dialog shows the real paper before printing.
    if (name === "print") {
      const m = await D.printPageModel(params.aid, me);
      const previews = {};
      if (printAllowed(m.role)) await Promise.all(m.surveys.map(async (s) => { const b = await loadBlankPrint({ request: (u, i) => fetch(u, i), token: token(), aid: m.aid, sid: s.id, role: m.role }); if (b.visible) { previews[s.id] = paperPreview(b, m); s.pages = `${b.items.length} question${b.items.length === 1 ? "" : "s"}`; } }));
      return { screen: "print", data: m, previews, canPrint: printAllowed(m.role) };
    }
    // Entering a paper answer needs the assisted-entry capability (cap.response.assisted_next, POST /v2/participate/next), which the
    // server refuses for everyone until an assisted collector can be authorised (src/handlers/response.ts, D6): said, never faked.
    if (name === "paper-entry") { const { assessment } = await D.assessment(params.aid); return { screen: "paper-entry", unavailable: true, assessment, message: `Entering paper answers for ${assessment.name} is not available yet: the assisted-entry capability (cap.response.assisted_next, POST /v2/participate/next) is refused by the server until an assisted collector can be authorised (D6). Hand the paper's QR link to the person instead, or wait for that capability.` }; }
    // Next step and the plan read the built report (the same results model as Results): a review with no report is offered the build.
    if (name === "next-step" || name === "action-plan") {
      const m = await D.resultsModel(params.aid, { build: false });
      return { screen: name, results: m, plan: m.payload ? D.nextStepModel(m) : null };
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
    build = null; uncertainBuild = null; // a pending build preview never outlives the route; a reload re-reads the report list, which clears the uncertain lock
    setLiveContext({ ...r.params, ...(r.query.get("review") && !r.params.aid ? { aid: r.query.get("review") } : {}) }); // a setup screen's review (router.linkFor)
    if (!PARTICIPANT.has(r.name)) { try { session = await S.me(); } catch { session = null; } applyChrome(session); }
    // The loading screen shows only when a read takes longer than a blink, so walking questions never flashes.
    const slow = setTimeout(() => { if (my === seq) page = { status: "loading", key: r.name, data: null, error: null }; }, 180);
    try {
      const data = await loader(r);
      clearTimeout(slow);
      if (my !== seq) return;
      if (data.redirect) { replace(data.redirect); return; }
      if (data.screen === null) return;
      // Review-scoped screens draw project crumbs (href("project") needs :pid): the loaded model's project joins the live context.
      const pid = data?.data?.projectId ?? data?.results?.review?.projectId ?? data?.shareData?.projectId ?? data?.projectId ?? null;
      if (pid && !r.params.pid) setLiveContext({ ...liveContext(), pid });
      page = { status: "ready", key: r.name, data, error: null };
    } catch (e) {
      clearTimeout(slow);
      if (my !== seq) return;
      const kind = classify(e);
      if (kind === "unauthenticated") { S.forget(); page = { status: "ready", key: r.name, data: { screen: "sign-in", next: hash }, error: null }; return; }
      page = { status: "error", key: r.name, data: null, error: { kind, message: String(e?.message || "Request could not be completed.") } };
    }
  }
  // Print QR pages for real: the chosen surveys' sheets (ui/assess/share.js) in their own tab, printing itself (app/print.js).
  const printQr = ({ surveys, per, paper }) => openQrPrint(globalThis, { title: page.data?.data?.review?.title ?? "", surveys, per, paper });
  // Print paper surveys for real (app/print.js): the forms are read and translated here, then open in their own tab from the result;
  // a blocked tab is said (the current UI's words), the ready line names what printed.
  let printStatus = $state(""), printBusy = $state(false);
  async function printPapers({ picked, lang, paper }) {
    const m = page.data?.data; if (!m) return;
    printBusy = true; printStatus = "Preparing the forms…";
    try {
      const models = await preparePapers(m, picked, { lang, onProgress: (t) => { printStatus = t; } });
      printStatus = openPapersPrint(globalThis, models, { paper, title: `${m.review.title} · paper surveys` }) ? models.map((x) => `${x.identity?.survey?.name ?? x.title}: ${printReadyLine(x)}`).join(" ") : "Your browser blocked the print page. Allow pop-ups for this site, then use Print again.";
    } catch (e) { printStatus = e?.message || "The blank questionnaire could not be prepared. Try Print again."; }
    finally { printBusy = false; }
  }
  // Send app feedback: the current UI's POST and receipt check (ui/assess/feedback.js), its words on refusal.
  async function sendFeedback(body) {
    try {
      const r = await api("/v2/feedback", { method: "POST", body });
      if (r?.recorded !== true || typeof r.feedback_id !== "string" || !r.feedback_id || r.stripped !== false) throw new Error("Unconfirmed receipt");
      return r;
    } catch (e) {
      const code = String(e?.code || e?.status || "");
      if (["401", "NOT_AUTHENTICATED"].includes(code)) { S.forget(); throw new Error("Your sign-in is no longer active. Your text is still here; copy it before signing in again."); }
      if (["403", "404", "NOT_AUTHORIZED", "NOT_AUTHORIZED_AT_SCOPE", "NOT_FOUND_OR_NOT_VISIBLE"].includes(code)) throw new Error("Feedback was refused for this account. Your text is still here.");
      if (["400", "INVALID_PARAMS"].includes(code)) throw new Error("Feedback was not accepted. Check your text length; your draft is still here.");
      if (code === "429" || code === "RATE_LIMITED") throw new Error(`${e.message} Your draft is still here.`);
      throw new Error("We could not confirm whether your feedback was recorded. Your text is still here. Sending again may create a duplicate; nothing will retry automatically.");
    }
  }
  $effect(() => { void route; load(); });
  // An in-page anchor (`collect#offline`) scrolls to its element once the screen is ready; the hash still names the route, so back/forward work.
  $effect(() => { if (page.status === "ready" && route.anchor) tick().then(() => document.getElementById(route.anchor)?.scrollIntoView({ block: "start" })); });
  $effect(() => { if (session === undefined) S.me().then((m) => { session = m; }).catch(() => { session = null; }); });

  // Participant actions (the journey owns persistence; these only navigate on its answer).
  let busy = $state(false), codeError = $state("");
  const land = () => { const [s, q] = P.screenFor(P.state()); go(to(s ?? "p-code", {}, q)); };
  async function redeem(code) {
    busy = true; codeError = "";
    const r = await P.redeem(code);
    busy = false;
    if (r.ok) { await P.start(); land(); return; }
    if (r.busy) { codeError = `${r.error} Try again in about ${r.retryAfter} s.`; return; }
    codeError = r.error;
  }
  let gaps = $state([]);
  async function send() { busy = true; gaps = []; try { const r = await P.submit(); if (r?.missing) { gaps = r.missing; return; } } finally { busy = false; } land(); }
  async function another() { busy = true; let r = null; try { r = await P.another(); } finally { busy = false; } if (!r?.navigated) land(); } // a code session already moved to code entry
  async function retry() { busy = true; try { if (P.state()?.phase === "review") await P.submit(); else await P.start({ retry: true }); } finally { busy = false; } land(); }
  const q = $derived(route.params.n);
  const pm = $derived(pstate.model);

  // Signed-in chrome for the live screens.
  const who = $derived(session ? { first: S.firstName(session.principal), initials: S.initialsOf(session.principal) } : null);
  async function signOut() { try { await S.signOut(); D.clearLinks(); SU.forgetAll(); session = null; go(to("landing")); } catch (e) { page = { status: "error", key: route.name, data: null, error: { kind: classify(e), message: `You are still signed in: ${e?.message || "the sign-out was not confirmed"}. Try again.` } }; } }
  const accountItems = $derived(session ? [
    { kind: "head", label: session.principal?.display_name || "Signed in", sub: session.principal?.id ? "Facilitator" : "" }, { kind: "hr" },
    { label: "Help and FAQ", href: to("help") }, { label: "Why 3D Review exists", href: to("about") }, { label: "Send app feedback", href: to("feedback", {}, { from: route.name, review: page.data?.data?.review?.title ?? page.data?.results?.review?.title ?? "" }) },
    { label: "Public website home", href: to("landing") }, { label: "Current design", href: "/" }, { kind: "hr" }, { label: "Sign out", onclick: signOut },
  ] : []);
  function onSignedIn() { D.clearLinks(); SU.forgetAll(); S.forget(); session = undefined; const next = page.data?.next; go(next && next !== "#/signin" ? next : to("home")); }
  // Report build (first build and "Refresh with new answers" alike): the current design's contract (ui/assess/report-build.js) —
  // the dry run first, then the person confirms a plain sentence with the response count, then execute spends the confirm token.
  // Nothing is built until the confirm; the pending token never outlives the route (load() clears it).
  let build = $state(null); // { aid, text, token, expires } while a preview waits for its confirm
  let building = $state(false);
  let uncertainBuild = $state(null); // aid whose execute response was lost: no new preview until load() re-reads the report list (ui/assess/report-build.js keeps the same lock)
  const say = (refreshed) => { page = { ...page, data: { ...page.data, refreshed } }; };
  async function refreshResults() {
    const aid = route.params.aid; const m = page.data?.results;
    if (building || build) return;
    if (uncertainBuild === aid) { say("A report build's outcome is unknown. Reload this page to see the report list before building again."); return; }
    build = null; say("");
    try { const out = await D.previewBuild(aid); if (out.held) { say("The results can’t be built yet: more answers are needed. Nothing was built."); return; } build = { aid, text: buildConfirmText(m?.review?.liveResponses ?? m?.review?.responses), token: out.token, expires: out.expires }; }
    catch (e) { say(`The preview could not be loaded. Nothing was built; ${e?.message || "try again"}.`); }
  }
  function cancelBuild() { build = null; say("Cancelled. Nothing was built."); }
  async function confirmBuild() {
    const b = build; if (!b || building) return;
    if (Date.now() >= b.expires) { build = null; say("Preview expired. Preview again before building."); return; }
    build = null; building = true;
    try { const out = await D.executeBuild(b.aid, b.token); if (out.held) say("The results can’t be built yet: more answers are needed. No report was built."); else load(); }
    catch (e) { uncertainBuild = b.aid; say(`The report build outcome could not be confirmed: ${e?.message || "reload to see whether a report was built"}. Rebuilding is locked until this page reloads the report list.`); }
    finally { building = false; }
  }
  async function launch() { const aid = route.params.aid ?? route.query.get("review"); try { await D.setStage(aid, "collect"); SU.forget(aid); go(to("collect", { aid })); } catch (e) { page = { status: "error", key: route.name, data: null, error: { kind: classify(e), message: e?.message || "The survey could not be launched." } }; } }
  async function completeReview() { const aid = route.params.aid; try { await D.setStage(aid, "improve"); go(to("home")); } catch (e) { page = { status: "error", key: route.name, data: null, error: { kind: classify(e), message: e?.message || "The review could not be marked complete." } }; } }
  async function reopenCollection() { const aid = route.params.aid; try { await D.setStage(aid, "collect"); go(to("share", { aid })); } catch (e) { page = { status: "error", key: route.name, data: null, error: { kind: classify(e), message: e?.message || "Collection could not be reopened." } }; } }
  // People actions (app/data.js: the same routes the current UI's permissions page calls); each lands on a fresh read, or the shell's error.
  const peopleScope = () => page.data?.data?.scope;
  const act = async (label, fn) => { try { await fn(); load(); } catch (e) { page = { status: "error", key: route.name, data: null, error: { kind: classify(e), message: `${label}: ${e?.message || "the request could not be completed"}` } }; } };
  // Send invitation = preview (dry run) → the person confirms recipient, role and scope in the current design's sentence
  // (ui/assess/permissions.js sheetSentence) → execute with the preview's token. Cancel sends nothing. An empty or malformed address is
  // the server's INVALID_PARAMS, shown as is.
  const sendInvite = ({ email, role }) => act("Invitation not sent", async () => {
    const scope = peopleScope();
    const out = await D.inviteWithConfirm(scope, { email, role }, (text) => !!globalThis.confirm?.(text), sheetSentence({ kind: "invite", params: { email, role } }, scope?.type));
    if (!out.sent) throw new Error("not confirmed; no invitation was sent");
  });
  const rowAction = (name, row) => act(name === "Withdraw" ? "Invitation not withdrawn" : "Access not removed", () => (row.pending ? D.revokeInvitation(row.key) : D.revokeGrant(peopleScope(), row.key)));
  // A role change is a danger twin: the dry run's impact is shown and the person confirms before execute (an owner elevation cannot be
  // undone here; a downgrade can revoke the person's outstanding invitations). Codex P1 on 26a86937.
  const changeRole = (row, role) => act("Role not changed", async () => {
    const p = await D.previewRole(peopleScope(), row.key, role);
    if (p?.suppressed === true || p?.status === "held") throw new Error("the server held the change");
    if (typeof p?.confirm_token !== "string") throw new Error("the preview could not be read");
    const impact = Array.isArray(p.impact?.affected) ? p.impact.affected.map((a) => a.will_see || a.summary || "").filter(Boolean).join(" ") : "";
    const ok = globalThis.confirm?.(`Change ${row.name || "this person"} to ${role}? ${impact}${p.impact?.irreversible ? " This cannot be undone here." : ""}`.trim());
    if (!ok) throw new Error("not confirmed; nothing changed");
    await D.executeRole(peopleScope(), row.key, role, p.confirm_token);
  });
  const acceptInvite = (id) => act("Invitation not accepted", () => D.acceptInvitation(id));
  const groupProject = (pid) => act("Project not added", async () => { await D.addProject(route.params.wid, pid); go(to("workspace", { wid: route.params.wid })); });
  async function closeCollection() { const aid = route.params.aid; try { await D.setStage(aid, "understand"); go(to("results", { aid })); } catch (e) { page = { status: "error", key: route.name, data: null, error: { kind: classify(e), message: e?.message || "Collection could not be closed." } }; } }
  const applyChrome = (s) => setLiveChrome(s ? { who: S.firstName(s.principal), initials: S.initialsOf(s.principal), workspace: "Your workspace", workspaces: [], accountItems, home: to("home"), workspaceItems: [{ kind: "micro", label: "Your workspaces" }, { label: "Home", href: to("home") }] } : { who: "", initials: "", workspace: "", workspaces: [], accountItems: [], home: to("home"), workspaceItems: [], signedOut: true });
  const chrome = $derived({ phone, theme, who, accountItems, session });
  $effect(() => { setLiveChrome(session ? { who: who.first, initials: who.initials, workspace: page.data?.home?.workspace ?? "Your workspace", workspaces: [], accountItems, home: to("home"), workspaceItems: [{ kind: "micro", label: "Your workspaces" }, { label: "Home", href: to("home") }] } : { who: "", initials: "", workspace: "", workspaces: [], accountItems: [], home: to("home"), workspaceItems: [], signedOut: true }); });
  // The phone boards (ResultsPhone.dc.html, fixtures/results/report.json "phone") draw each perspective's strongest and weakest area only.
  const phonePayload = (payload) => ({ ...payload, lenses: (payload.lenses ?? []).map((l) => { const sd = [...(l.sub_dimensions ?? [])].filter((x) => Number.isFinite(Number(x.score))).sort((a, b) => Number(b.score) - Number(a.score)); return { ...l, sub_dimensions: sd.length > 2 ? [sd[0], sd[sd.length - 1]] : l.sub_dimensions }; }) });
  // Setup steps 1-4 (app/setup.js): the open state lives outside the page (its draft is edited in place); suRev re-derives the views.
  let suSt = null, suRev = $state(0), suBusy = $state(false), suError = $state("");
  const bump = () => { suRev++; };
  const suView = $derived.by(() => { void suRev; const st = suSt; if (!st || page.status !== "ready" || !SETUP.has(page.data?.screen ?? "")) return null; return { details: SU.detailsView(st, phone), passage: SU.passageView(st), groups: SU.groupsOf(st, phone), context: SU.contextView(st), status: suBusy ? "Saving…" : st.aid ? "Draft saved" : "" }; });
  const fail = (e, fallback) => { if (classify(e) === "unauthenticated") { S.forget(); page = { status: "ready", key: route.name, data: { screen: "sign-in", next: hash }, error: null }; return; } suError = e?.message || fallback; };
  async function suAct(fn, then, fallback = "The change could not be saved.") { if (suBusy) return; suBusy = true; suError = ""; bump(); try { await fn(); suBusy = false; bump(); then?.(); } catch (e) { suBusy = false; fail(e, fallback); bump(); } }
  const suNext = (n) => go(to(`setup${n}`, {}, { review: suSt.aid }));
  function suField(k, v) {
    const d = suSt.draft;
    if (k === "project") { const p = suSt.projects.find((x) => x.name === v); d.project = p?.id ?? ""; d.language = ""; d.languageQuery = ""; suSt.languages = []; suAct(() => SU.loadLanguages(suSt), undefined, "The project's languages could not be read."); return; }
    if (k === "format") { const was = SU.COMMUNITY_TEMPLATE[d.format]; d.format = SU.formatValue(v); const now = SU.COMMUNITY_TEMPLATE[d.format]; if (was && was !== now && d.groups[was] && !suSt.pre.some((x) => x.template === was)) { const g = d.groups[was]; delete d.groups[was]; delete d.context[was]; if (g.checked) d.groups[now] = { ...g, version: String(suSt.templates.find((t) => t.id === now)?.version ?? g.version) }; } } else d[k] = v; // the Community survey follows the format (Codex P1 on 26a86937)
    suError = ""; bump();
  }
  const suLang = {
    oninput: (q) => { suSt.draft.languageQuery = q; bump(); },
    onpick: (m) => suAct(() => SU.pickLanguage(suSt, m.id), undefined, "The language could not be chosen."),
    onremove: () => { suSt.draft.language = ""; bump(); },
    onadd: () => suAct(() => SU.addLanguage(suSt, suSt.draft.languageQuery), undefined, "The language could not be added."),
  };
  const suStep = {
    1: () => { const errs = SU.validateDetails(suSt.draft); if (errs.length) { suError = errs.join(" "); bump(); return; } suAct(() => SU.saveDetails(suSt), () => (suSt.stage !== "prepare" ? go(to("review", { aid: suSt.aid })) : suNext(2)), "The review could not be saved."); },
    2: () => { if (!suSt.draft.purpose.trim()) { suError = "Name what people will respond to first."; bump(); return; } suAct(() => SU.savePassage(suSt), () => suNext(3)); },
    3: () => { const errs = SU.validateGroups(suSt.draft); if (errs.length) { suError = errs.join(" "); bump(); return; } suAct(() => SU.saveGroups(suSt), () => suNext(4), "The surveys could not be updated."); },
    4: () => suAct(() => SU.saveContext(suSt), () => go(to("setup5", {}, { review: suSt.aid })), "The surveys could not be added."),
  };
  const suPassage = {
    onfile: (f) => suAct(() => SU.addPassageFile(suSt, f), undefined, "The file could not be uploaded."),
    onlink: () => { const url = globalThis.prompt?.("Paste the link (https://…), for example a sign-language video:"); if (url && url.trim()) suAct(() => SU.addPassageLink(suSt, url.trim()), undefined, "The link could not be added."); },
    onremove: (id) => suAct(() => SU.removePassage(suSt, id), undefined, "The passage could not be removed."),
    onlwc: (action, code) => { const d = suSt.draft; if (action === "remove") d.lwc = d.lwc.filter((c) => c !== code); else { const l = SU.lwcMatch(code); if (!l) { suError = `"${code}" is not a language the survey can be shown in.`; bump(); return; } if (d.lwc.length >= SU.MAX_LWC_COUNT && !d.lwc.includes(l.code)) { suError = `Up to ${SU.MAX_LWC_COUNT} answer languages.`; bump(); return; } if (!d.lwc.includes(l.code)) d.lwc = [...d.lwc, l.code]; } suError = ""; bump(); },
  };
  const suGroups = { ongroup: (tid, version, on) => { SU.setGroup(suSt, tid, version, on); suError = ""; bump(); }, onexpected: (tid, v) => { SU.setExpected(suSt, tid, v); bump(); } };
  const suContext = { oncontext: (key, field, v) => { const tid = SU.tidOfKey(suSt, key); if (tid) SU.setContext(suSt, tid, field, v); }, ondemographics: (on) => { suSt.draft.demographics = on; bump(); } };
  const reportFor = (m) => (m.payload ? { review: m.review, counts: m.counts, sent: m.sent, payload: phone ? phonePayload(m.payload) : m.payload, gaps: D.gapsOf(m.payload), radar: D.radarOf(m.payload), lookNext: [] } : null);
</script>

<!-- The build confirm (report-build.js: one plain sentence with the response count, confirm "Build the results", cancel "Not now").
     primary: on the not-built page it takes the page's one primary (the trigger is gone while it shows); on Results it stays secondary. -->
{#snippet buildConfirm(primary)}
  <Card hi gap={3} label="Build the results">
    <p class="small t-15" data-confirm-text>{build.text}</p>
    <div class="l-row" data-gap="2"><button class={primary ? "btn btn-primary" : "btn"} type="button" data-confirm-report onclick={confirmBuild}>Build the results</button><button class="btn btn-quiet" type="button" data-cancel-report onclick={cancelBuild}>Not now</button></div>
  </Card>
{/snippet}

{#if page.status === "loading"}
  <Status {phone} {theme} kind="loading" />
{:else if page.status === "error"}
  <Status {phone} {theme} kind={page.error.kind} message={page.error.message} onretry={load} />
{:else if page.data.fixture}
  {@const C = REGISTRY[page.data.screen]}
  <Status {phone} {theme} kind="preview" inline message="Sample data: a made-up review that shows the design. Nothing here is saved." back={to("home")} backLabel="Home" />
  <C {phone} {theme} state={route.query.get("state") ?? undefined} />
{:else if page.data.screen === "landing"}
  <Landing {phone} {theme} home={session ? to("home") : undefined} />
{:else if page.data.screen === "about"}
  <About {phone} {theme} />
{:else if page.data.screen === "sign-in"}
  <SignInLive {phone} {theme} onsignedin={onSignedIn} />
{:else if page.data.screen === "help"}
  {@const C = REGISTRY.help}
  <C {phone} {theme} />
{:else if page.data.screen === "feedback"}
  {@const C = REGISTRY.feedback}
  <C {phone} {theme} user={{ first: who?.first ?? "", initials: who?.initials ?? "" }} workspace={page.data.home?.workspace ?? "Your workspace"} from={page.data.from} allowed={page.data.allowed} onsend={sendFeedback} />
{:else if page.data.screen === "menu"}
  {@const C = REGISTRY.menu}
  <C {theme} data={page.data.menu} />
{:else if page.data.screen === "print"}
  {#if !page.data.canPrint}
    <Status {phone} {theme} kind="refused" message="Your role here cannot print blank surveys (an owner or member can)." back={to("collect", route.params)} backLabel="Back to Collect" />
  {:else}
    {@const C = REGISTRY.print}
    <C {phone} {theme} data={page.data.data} previews={page.data.previews} onprint={printPapers} status={printStatus} busy={printBusy} />
  {/if}
{:else if page.data.unavailable}
  <Status {phone} {theme} kind="unavailable" message={page.data.message} back={page.data.assessment ? to("collect", { aid: page.data.assessment.id }) : to("home")} backLabel={page.data.assessment ? "Back to Collect" : "Home"} />
{:else if page.data.screen === "next-step" || page.data.screen === "action-plan"}
  {@const m = page.data.results}
  {#if page.data.sample}<Status {phone} {theme} kind="preview" inline message="Sample data: a made-up review that shows the design." back={to("home")} backLabel="Home" />{/if}
  {#if !page.data.plan}
    <Status {phone} {theme} kind="not_built" message={`No report has been built for ${m.review.title} yet, so there is nothing to plan from. ${m.canBuild ? "Build it on Results first." : "An owner or member of the review builds it."}`} back={to("results", route.params)} backLabel="Go to Results" />
  {:else}
    {@const C = REGISTRY[page.data.screen]}
    <C {phone} {theme} data={page.data.plan} user={{ first: who?.first ?? "", initials: who?.initials ?? "" }} workspace="Your workspace" oncomplete={m.serverStage === "understand" && m.canBuild ? completeReview : undefined} />
  {/if}
{:else if page.data.screen === "home"}
  <Home {phone} {theme} data={page.data.home} state={phone ? "reviews" : page.data.state} />
{:else if page.data.screen === "project"}
  {@const C = REGISTRY.project}
  <C {phone} {theme} data={page.data.data} />
{:else if SETUP.has(page.data.screen) && page.data.step && suView}
  {@const C = REGISTRY[page.data.screen]}
  {@const n = page.data.step}
  {#if n === 1}<C {phone} {theme} data={suView.details} onfield={suField} lang={suLang} onnext={suStep[1]} busy={suBusy} error={suError} status={suView.status} />
  {:else if n === 2}<C {phone} {theme} data={suView.passage} onfield={suField} onfile={suPassage.onfile} onlink={suPassage.onlink} onremove={suPassage.onremove} onlwc={suPassage.onlwc} onnext={suStep[2]} busy={suBusy} error={suError} status={suView.status} />
  {:else if n === 3}<C {phone} {theme} data={{ groups: suView.groups }} ongroup={suGroups.ongroup} onexpected={suGroups.onexpected} onnext={suStep[3]} busy={suBusy} error={suError} status={suView.status} />
  {:else}<C {phone} {theme} data={{ groups: suView.groups, context: suView.context }} oncontext={suContext.oncontext} ondemographics={suContext.ondemographics} onexpected={suGroups.onexpected} onnext={suStep[4]} busy={suBusy} error={suError} status={suView.status} />{/if}
{:else if page.data.screen === "setup5"}
  {@const C = REGISTRY.setup5}
  <C {phone} {theme} data={page.data.data} onlaunch={page.data.data.canLaunch ? launch : undefined} collecting={page.data.data.stage !== "prepare"} />
{:else if page.data.screen === "share"}{@const C = REGISTRY.share}
  <C {phone} {theme} data={page.data.shareData} share={page.data.share} role={page.data.shareData.role} />
{:else if page.data.screen === "collect" || page.data.screen === "close-collection" || page.data.screen === "qr-room" || page.data.screen === "print-qr"}
  {#if page.data.empty}
    <Status {phone} {theme} kind="empty" message={page.data.emptyText} back={to("review", route.params)} backLabel="Back to the review" onretry={load} />
  {:else}
    {@const C = REGISTRY[page.data.screen]}
    <C {phone} {theme} data={page.data.data} state={route.query.get("state") ?? undefined} onclose={page.data.screen === "close-collection" ? closeCollection : undefined} onprint={page.data.screen === "print-qr" ? printQr : undefined} />
  {/if}
{:else if page.data.screen === "results" || page.data.screen === "results-gaps" || page.data.screen === "results-answers" || page.data.screen === "report" || page.data.screen === "report-detailed" || page.data.screen === "results-held"}
  {@const m = page.data.results}
  {@const rep = reportFor(m)}
  {#if page.data.sample}<Status {phone} {theme} kind="preview" inline message="Sample data: a made-up review that shows the design. Your own reviews read their results from the server." back={to("home")} backLabel="Home" />{/if}
  {#if !rep && !m.held && page.data.screen !== "results-held"}
    <NotBuilt {chrome} {phone} {theme} crumbs={[{ label: m.review.project, href: m.review.projectId ? to("project", { pid: m.review.projectId }) : to("home") }, { label: m.review.title }]} message={`No report has been built for ${m.review.title} yet. ${m.canBuild ? "Building reads the answers collected so far and keeps that report." : "An owner or member of the review builds it."}${page.data.refreshed ? ` ${page.data.refreshed}` : ""}`} back={to("collect", route.params)} backLabel="Back to Collect">
      {#if m.canBuild}{#if build}{@render buildConfirm(true)}{:else}<Row gap={2}><button class="btn btn-primary btn-lg" type="button" onclick={refreshResults} disabled={building || undefined}>{building ? "Building the results…" : "Build the report"}</button></Row>{/if}{/if}
    </NotBuilt>
  {:else if !rep || page.data.screen === "results-held"}
    {@const Held = REGISTRY["results-held"]}
    <Held {phone} {theme} report={{ review: m.review, counts: m.counts, sent: m.sent, payload: m.payload ?? { lenses: [] }, held: m.held }} onreopen={reopenCollection} />
  {:else if page.data.screen === "results-answers"}
    {@const C = REGISTRY["results-answers"]}
    {#if page.data.answers?.suppressed}
      <Status {phone} {theme} kind="held" message={`Answer-by-answer rows are not disclosed for this review: ${page.data.answers.reason ?? "held by policy"} (the server holds them for everyone, owners included). The levels and gaps on Results are built from these answers.`} inline back={to("results", route.params)} backLabel="Back to Results" />
    {:else}
      <C {phone} {theme} report={rep} state={route.query.get("state") ?? undefined} />
    {/if}
  {:else if page.data.screen === "results"}
    {@const C = REGISTRY.results}
    <C {phone} {theme} report={rep} onrefresh={refreshResults} refreshed={building ? "Building the results…" : page.data.refreshed ?? ""}>{#if build}{@render buildConfirm(false)}{/if}</C>
  {:else}
    {@const C = REGISTRY[page.data.screen]}
    <C {phone} {theme} report={rep} />
  {/if}
{:else if page.data.screen === "explore"}
  {@const C = REGISTRY.explore}
  <C {phone} {theme} data={page.data.data} state={route.query.get("state") ?? undefined} />
{:else if page.data.screen === "workspace" || page.data.screen === "workspace-group"}
  {@const C = REGISTRY[page.data.screen]}
  <C {phone} {theme} data={page.data.data} ongroup={groupProject} />
{:else if page.data.screen === "people" || page.data.screen === "people-workspace"}
  {#if page.data.empty}
    <Status {phone} {theme} kind="empty" message={page.data.emptyText} back={to("home")} backLabel="Your reviews" />
  {:else if page.data.data.refused}
    <Status {phone} {theme} kind="refused" message="Permissions are managed by members and owners: a viewer cannot read who has access here. Ask an owner if you need to manage people." back={page.data.data.review ? to("review", { aid: page.data.data.review.id }) : to("workspace", { wid: page.data.data.workspace.id })} backLabel={page.data.data.review ? "Back to the review" : "Back to the workspace"} />
  {:else}
    {@const C = REGISTRY[page.data.screen]}
    <C {phone} {theme} data={page.data.data} oninvite={sendInvite} onaction={rowAction} onrole={changeRole} />
  {/if}
{:else if page.data.screen === "invitations"}
  {@const C = REGISTRY.invitations}
  <C {phone} {theme} data={page.data.data} onaccept={acceptInvite} />
{:else if page.data.preview}
  {@const C = REGISTRY[page.data.screen]}
  <Status {phone} {theme} kind="preview" message={`This screen is a design preview with sample data${page.data.assessment ? ` (your review: ${page.data.assessment.name})` : ""}. ${page.data.previewNote ?? (page.data.editHref ? "Editing a review's details, surveys, passage and dates happens in the current design for now." : "The current design still does this for real.")}`} inline back={page.data.editHref ?? (page.data.assessment ? to("review", { aid: page.data.assessment.id }) : to("home"))} backLabel={page.data.previewNote ? "Send feedback in the current design" : page.data.editHref ? `Edit ${page.data.assessment?.name ?? "this review"} in the current design` : page.data.assessment ? "Back to the review" : "Home"} />
  <C {phone} {theme} state={route.query.get("state") ?? undefined} />
{:else if page.data.screen === "p-code"}
  {@const C = REGISTRY["p-code"]}
  <C phone={true} {theme} onredeem={redeem} message={codeError} {busy} state={codeError ? "error" : undefined} />
{:else if pm}
  {#if page.data.screen === "p-welcome"}{@const C = REGISTRY["p-welcome"]}<C phone={true} {theme} d={pm} onlang={P.setLanguage} />
  {:else if page.data.screen === "p-passage"}{@const C = REGISTRY["p-passage"]}<C phone={true} {theme} d={pm} />
  {:else if page.data.screen === "p-about"}{@const C = REGISTRY["p-about"]}<C phone={true} {theme} d={pm} onabout={P.setAbout} />
  {:else if page.data.screen === "p-question"}{@const C = REGISTRY["p-question"]}{#key q}<C phone={true} {theme} d={pm} {q} onanswer={P.answer} onother={P.other} />{/key}
  {:else if page.data.screen === "p-review"}{@const C = REGISTRY["p-review"]}<C phone={true} {theme} d={pm} onsend={send} {busy} notice={gaps.length ? `${gaps.length === 1 ? "One question still needs an answer" : `${gaps.length} questions still need an answer`} before you send: ${gaps.map((g) => g.n).join(", ")}.` : pm.notice} missing={gaps} />
  {:else if page.data.screen === "p-receipt"}{@const C = REGISTRY["p-receipt"]}<C phone={true} {theme} d={pm} onanother={another} notice={pm.notice} />
  {:else if page.data.screen === "p-problem"}{@const C = REGISTRY["p-problem"]}<C phone={true} {theme} d={pm} onretry={retry} state={route.query.get("state") ?? undefined} />
  {/if}
{:else}
  <Status {phone} {theme} kind="empty" message="Open your survey link, or enter your code." back={to("p-code")} backLabel="Enter a code" />
{/if}
