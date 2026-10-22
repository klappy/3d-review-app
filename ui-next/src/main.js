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
import "./gallery.css";
import App from "./App.svelte";
import Layouts from "./Layouts.svelte";
import HomeParts from "./HomeParts.svelte";

import Home from "./screens/Home.svelte";
import About from "./screens/About.svelte";
import Landing from "./screens/Landing.svelte";
import { REGISTRY } from "./screens/registry.js";
import { route, wOverride, PHONE_QUERY } from "./route.js";

let storage;
try { storage = window.localStorage; } catch { storage = undefined; }
const VIEWS = { ...REGISTRY, home: Home, about: About, landing: Landing, components: App, layouts: Layouts, "home-parts": HomeParts };
const params = new URLSearchParams(location.search);
const target = document.getElementById("next");
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
