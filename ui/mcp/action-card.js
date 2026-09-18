// Host-call presentation only. No automatic tool calls or persisted arguments/tokens.
export function createActionCard({ root, esc, call, explore, execution }) {
  let input = null, envelope = null, pending = null, busy = false, message = '';
  const decode = event => event?.structuredContent || (() => { try { return JSON.parse(event?.content?.[0]?.text); } catch { return event; } })();
  const label = cap => ({'cap.grant.invite':'Invite collaborator','cap.report.build':'Build report','cap.workspace.delete':'Delete workspace','cap.assessment.get':'Assessment','cap.project.get':'Project','cap.workspace.get':'Workspace'}[cap] || (typeof cap === 'string' ? cap.replace(/^cap\./, '').split('.').join(' ') : '3D Review guidance'));
  const trace = env => env?.trace_id ? `<p class="small muted">trace ${esc(env.trace_id)}</p>` : '';
  const impactDetails = impact => !impact || typeof impact !== 'object' ? '' : `<dl class="action-impact">${['effect','irreversible','compensating_control','affected'].filter(key => Object.hasOwn(impact,key)).map(key => `<dt>${esc(key.replaceAll('_',' '))}</dt><dd>${esc(typeof impact[key] === 'object' ? JSON.stringify(impact[key]) : String(impact[key]))}</dd>`).join('')}</dl>`;
  function templateQuestions(result) {
    const items = Array.isArray(result.items) ? result.items : Array.isArray(result.template?.items) ? result.template.items : [];
    const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    return `<p class="small">Read-only questionnaire · ${esc(items.length)} questions · ${esc(text(result.template?.perspective))} · version ${esc(text(result.template?.version) || 'unavailable')}</p>${items.length ? `<ol class="survey-questions">${items.map(item => `<li><h3>${esc(text(item?.text) || text(item?.id) || 'Question text unavailable')}</h3>${item?.requiredness === 'unresolved' ? '<p>May leave unanswered; requirement policy is unresolved.</p>' : ''}${item?.answer_semantics === 'unresolved_no_problems_vs_skipped' ? '<p>Leaving this blank is unknown, not “no problems.”</p>' : ''}${item?.type === 'scale' ? `<p>Scale: ${esc(text(item.scale?.min))} to ${esc(text(item.scale?.max))}</p>` : item?.type === 'text' ? '<p>Written response</p>' : ['single','multi'].includes(item?.type) ? `<p>${item.type === 'single' ? 'Choose one' : 'Choose all that apply'}</p><ul>${(Array.isArray(item.options) ? item.options : []).map(option => `<li>${esc(text(option?.label) || text(option?.text) || text(option?.code))}${option?.exclusive || option?.flag === 'exclusion' ? ' (cannot combine with other choices)' : ''}</li>`).join('')}</ul>` : '<p>Question format unavailable.</p>'}</li>`).join('')}</ol>` : '<p>No questions were included in this result.</p>'}`;
  }
  function render() {
    const env = envelope, result = env?.result || {}, cap = env?.capability || input?.capability;
    let title = label(cap), body = 'Waiting for this tool result…', state = 'loading', entity = null, questions = ''; 
    if (env) {
      if (env.ok === false || env.isError) { title = 'Not available'; body = 'This request could not be completed.'; state = 'refused'; }
      else if (cap === 'cap.ops.feedback') { title = 'Feedback received'; body = 'Your feedback was recorded. Its private contents are not displayed here.'; state = 'complete'; }
      else if (cap === 'cap.auth.me') { title = 'Sign-in checked'; body = 'The assistant received the current authorization details.'; state = 'complete'; }
      else if (cap === 'cap.ops.health') { title = 'Service status'; body = `Version ${typeof result.version === 'string' ? result.version : 'unavailable'}`; state = 'complete'; }
      else if (result.suppressed === true || result.status === 'held') { title = 'Result held'; body = 'This result remains unavailable under the current policy.'; state = 'held'; }
      else if (['cap.template.get','cap.template.render'].includes(cap)) { title = result.template?.name || 'Survey questionnaire'; body = 'Questions returned by this request. This view does not submit answers.'; state = 'complete'; questions = templateQuestions(result); }
      else {
        entity = result.assessment || result.project || result.workspace;
        title = entity?.name || title;
        body = pending ? 'Review this action before confirming. It may make an irreversible change.' : entity ? 'This is the entity returned by your request.' : cap ? 'The requested operation returned successfully.' : 'Guidance is available in the assistant’s tool response.';
        state = pending ? 'preview' : 'complete';
      }
    }
    root.innerHTML = `<section class="panel action-card" data-state="${state}"><h2>${esc(title)}</h2><p>${esc(message || body)}</p>${questions}${pending ? `<p class="small">Action: ${esc(label(pending.capability))} · scope ${esc(pending.params.scope || '')} ${esc(pending.params.id || pending.params.aid || '')}${pending.capability === 'cap.grant.invite' ? ` · recipient ${esc(pending.params.email || '')} · role ${esc(pending.params.role || '')}` : ''}</p>${impactDetails(pending.impact)}<p class="small">Confirmation expires in ${esc(pending.expiresIn)} seconds.</p><div class="actions"><button data-card-confirm ${busy ? 'disabled' : ''}>Confirm action</button><button data-card-cancel ${busy ? 'disabled' : ''}>Cancel</button></div>` : ''}${trace(env)}<button class="quiet" data-card-explore ${busy ? 'disabled' : ''}>Open workspaces</button></section>`;
    root.querySelector('[data-card-explore]').onclick = () => { if (!busy) { pending = null; explore(); } };
    root.querySelector('[data-card-cancel]')?.addEventListener('click', () => { if (!busy) { pending=null; message='Cancelled. No action was executed by this card.'; render(); } });
    root.querySelector('[data-card-confirm]')?.addEventListener('click', async () => {
      if (busy || !pending) return;
      const action=pending; pending=null;
      if (Date.now() >= action.expires) { message='Preview expired. Ask the assistant to preview again.'; render(); return; }
      busy=true; execution(true); message='Executing confirmed action…'; render();
      try {
        envelope=await call('danger',{capability:action.capability,params:action.params,mode:'execute',confirm_token:action.token});
        message='';
      } catch (error) {
        envelope={ok:false,trace_id:error?.trace_id};
        message='The outcome could not be confirmed. Check the action state before requesting another preview; no automatic retry was made.';
      } finally { busy=false; execution(false); render(); }
    });
  }
  function receiveInput(event) {
    if (busy) return false;
    // Clone now so host object mutation cannot change the later confirmed parameters.
    input=event?.arguments ? JSON.parse(JSON.stringify(event.arguments)) : null;
    envelope=null;pending=null;message='';render();return true;
  }
  function receiveResult(event) {
    if (busy) return false;
    envelope=decode(event);pending=null;message='';
    if (event?.isError && envelope) envelope={...envelope,isError:true};
    const r=envelope?.result;
    if (envelope?.ok === true && !envelope.isError && input?.mode === 'dry_run' && input.capability === envelope.capability && r?.suppressed !== true && typeof r?.confirm_token === 'string' && r.confirm_token && Number.isFinite(r.expires_in) && r.expires_in>0) {
      pending={capability:input.capability,params:input.params || {},token:r.confirm_token,expires:Date.now()+r.expires_in*1000,expiresIn:r.expires_in,impact:r.impact || envelope.impact};
    }
    render();return true;
  }
  return {render,receiveInput,receiveResult};
}
