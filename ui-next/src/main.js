// UI Next (v4) /next/ entry. Status: provisional. Loads the external contract CSS and mounts the fixture gallery.
import { mount } from "svelte";
import "../tokens.css";
import "../components/button.css";
import "../components/pill.css";
import "../components/lensdot.css";
import "./gallery.css";
import App from "./App.svelte";

const params = new URLSearchParams(location.search);
const theme = params.get("theme");
mount(App, { target: document.getElementById("next"), props: { mode: ["light", "dark"].includes(theme) ? theme : "both" } });
