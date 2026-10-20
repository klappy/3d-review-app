// UI Next (v4) /next/ entry. Status: provisional. Loads the external contract CSS and mounts the fixture gallery.
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
import "./gallery.css";
import App from "./App.svelte";
import Layouts from "./Layouts.svelte";
import HomeParts from "./HomeParts.svelte";

const params = new URLSearchParams(location.search);
const theme = params.get("theme");
const mode = ["light", "dark"].includes(theme) ? theme : "both";
const target = document.getElementById("next");
if (params.get("page") === "layouts") mount(Layouts, { target, props: { mode, phone: params.get("w") === "phone" } });
else if (params.get("page") === "home") mount(HomeParts, { target, props: { mode, phone: params.get("w") === "phone" } });
else mount(App, { target, props: { mode } });
