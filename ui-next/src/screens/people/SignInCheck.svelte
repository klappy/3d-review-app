<!-- UI Next (v4) "Check your email" (magic-link sent, code fallback). Status: provisional (playbook rule 12).
     Boards (cookbook design/2026-10-15-glass-redesign/canvas): SignInCheck.dc.html, SignInCheckPhone.dc.html.
     The SignIn screen at step "check" (./SignIn.svelte); the route's props pass through. -->
<script>
  import SignIn from "./SignIn.svelte";
  let { phone = false, theme = "light", state } = $props();
</script>

<SignIn step="check" {phone} {theme} {state} />
