<script>
  import Grid from '../Grid.svelte';
  import { readPlanDates, writePlanDates } from './plan-dates.js';
  let { text = '', disabled = false, onchange } = $props();
  const dates = $derived(readPlanDates(text));
  function change(key, value) {
    if (!disabled && onchange) onchange(writePlanDates(text, { [key]: value }));
  }
</script>

<Grid cols={2} gap={3}>
  <div><label class="lbl" for="plan-follow-up">Follow up on <span class="opt">(optional)</span></label><input class="in" id="plan-follow-up" type="date" value={dates.followUp} disabled={disabled || !onchange} onchange={event => change('followUp', event.currentTarget.value)} /></div>
  <div><label class="lbl" for="plan-review-again">Review again on <span class="opt">(optional)</span></label><input class="in" id="plan-review-again" type="date" value={dates.reviewAgain} disabled={disabled || !onchange} onchange={event => change('reviewAgain', event.currentTarget.value)} /></div>
</Grid>
<p class="small">Dates are saved with the plan notes when you save. They do not schedule a reminder or create another review.</p>
