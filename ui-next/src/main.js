// UI Next (v4) /next/ entry. Status: provisional. Loads the external contract CSS; mounts Home when the ui_next flag is on, else the gallery (route.js).
import { mount } from "svelte";
import "../tokens.css";
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
import "./gallery.css";
import App from "./App.svelte";
import Layouts from "./Layouts.svelte";
import HomeParts from "./HomeParts.svelte";

import Home from "./screens/Home.svelte";
import { route } from "./route.js";

let storage;
try { storage = window.localStorage; } catch { storage = undefined; }
const { view, props } = route(new URLSearchParams(location.search), storage);
const VIEWS = { home: Home, components: App, layouts: Layouts, "home-parts": HomeParts };
mount(VIEWS[view], { target: document.getElementById("next"), props });
