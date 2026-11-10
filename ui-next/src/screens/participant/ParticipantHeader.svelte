<!-- UI Next (v4) participant phone header (lane variant of the shared PhoneHeader). Status: provisional (playbook rule 12).
     Contract: cookbook design-system.md section 2 "Phone chrome" (R13, V-19): .phone-top[data-shell=participant] = brand as plain text
     (not a link: a participant has nowhere else to go) -> right: the language button. No avatar, no back, no crumb; Back and Next live
     only in the phone-bar. Boards: every P*.dc.html (gen.py phone_header). The language button opens the survey's languages (not ported). -->
<script>
  import Mark from "../../Mark.svelte";
  import Button from "../../Button.svelte";
  import Icon from "../../Icon.svelte";
  import { P } from "./icons.js";
  let { language = "English" } = $props();
</script>

{#snippet globe()}<Icon d={P.globe} />{/snippet}
{#snippet chev()}<Icon d={P.chev} />{/snippet}

<header class="phone-top" data-shell="participant">
  <span class="brand"><Mark size={26} /><span>3D Review</span></span>
  <Button label={language} variant="quiet" ariaLabel={`Language: ${language}`} lead={globe} trail={chev} />
</header>
