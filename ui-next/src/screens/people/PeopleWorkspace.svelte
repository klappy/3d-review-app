<!-- UI Next (v4) People in this workspace. Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): PeopleWorkspace.dc.html, PeopleWorkspacePhone.dc.html.
     The People screen at workspace scope (./People.svelte); the route's props pass through. -->
<script>
  import People from "./People.svelte";
  let { phone = false, theme = "light", state } = $props();
</script>

<People scope="workspace" {phone} {theme} {state} />
