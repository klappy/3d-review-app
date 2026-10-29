// UI Next (v4) /next/ entry. Status: provisional. Loads the external contract CSS; mounts Home when the ui_next flag is on, else the gallery (route.js);
// lane screens come from screens/registry.js (one screens/<lane>/index.js per lane).
import { mount, unmount } from "svelte";
import "../tokens.css";
import "../components/base.css";
import "../components/button.css";
import "../components/pill.css";
import "../components/lensdot.css";
import "../components/layout.css";
import "../components/topbar.css";
import "../components/menu.css";
import "../components/tag.css";
import "../components/level.css";
import "../components/phone.css";
import "../components/type.css";
import "../components/disclosure.css";
import "../components/qr.css";
import "./gallery.css";
import App from "./App.svelte";
import Layouts from "./Layouts.svelte";
import HomeParts from "./HomeParts.svelte";

import Home from "./screens/Home.svelte";
import About from "./screens/About.svelte";
import Landing from "./screens/Landing.svelte";
import { REGISTRY } from "./screens/registry.js";
import { route, wOverride, PHONE_QUERY, liveEntry } from "./route.js";
import Live from "./app/Live.svelte";
import { useLevelMinimum } from "./screens/results/data.js";

let storage;
try { storage = window.localStorage; } catch { storage = undefined; }
const VIEWS = { ...REGISTRY, home: Home, about: About, landing: Landing, components: App, layouts: Layouts, "home-parts": HomeParts };
const params = new URLSearchParams(location.search);
const target = document.getElementById("next");
// Entry contract (route.js, glass-v4 ASK option 1): the flag is off by default and client-only; ?ui_next=on stores the opt-in and
// ?ui_next=off clears it (flagOn). With the flag on, /next/ (and any #/route or #survey= hash) mounts the live app (app/Live.svelte).
// Explicit fixture selection stays on the query form: ?screen=<name> is a fixture board (the pixel harness and tests), ?page= the
// gallery. With the flag off and no explicit selection, the gallery shows, as before. The current UI's account menu links here with
// ?ui_next=on ("Try the new design", playbook stage 5).
// Production builds (vite.next.config.mjs define, WORKERS_CI_BRANCH=production) compile the fixture harness out: always the live app.
const HARNESS = typeof __UI_NEXT_FIXTURE_HARNESS__ === "undefined" || __UI_NEXT_FIXTURE_HARNESS__;
const live = !HARNESS || liveEntry(params, storage);
if (live) {
  mount(Live, { target });
} else {
// Fixture harness only (never the live app): the fixtures are DEV-like reviews, so they band at the DEV level minimum of 1, set
// explicitly here. The live app reads the server's level_minimum_responses instead and falls back to the safe 3.
useLevelMinimum(1);
// Screens follow the viewport (phone below 720px, route.js PHONE_BELOW) unless ?w= overrides; remount when the width crosses it.
const mq = typeof window.matchMedia === "function" ? window.matchMedia(PHONE_QUERY) : null;
let view;
const draw = () => {
  const r = route(params, storage, Object.keys(REGISTRY), mq ? (mq.matches ? 0 : Infinity) : window.innerWidth);
  view = r.view;
  return mount(VIEWS[view], { target, props: r.props });
};
let app = draw();
if (mq && !wOverride(params) && !["components", "layouts", "home-parts"].includes(view)) mq.addEventListener("change", () => { unmount(app); target.replaceChildren(); app = draw(); });
}
