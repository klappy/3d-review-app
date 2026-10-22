<!-- UI Next (v4) Workspace with the "Add a project to this workspace" dialog open. Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): WorkspaceGroup.dc.html, WorkspaceGroupPhone.dc.html.
     The Workspace screen with group = true (./Workspace.svelte); the route's props pass through. -->
<script>
  import Workspace from "./Workspace.svelte";
  let { phone = false, theme = "light", data, ongroup } = $props(); // any ?state= renders the default (no board draws one); data/ongroup: live (Workspace.svelte)
</script>

<Workspace group {phone} {theme} {...(data ? { data } : {})} {ongroup} />
