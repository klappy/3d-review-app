import { observedIdentity } from './public-entry.js';
import { parseEntryFragment, currentNamespace } from './shared-link.js';

// Presentation only: never changes authority-bearing hidden flags or select values.
export function compositionState({shared=false,legacy=false,staff=false,hash='',selected,context=false,invitation=false}) {
  const route = invitation ? 'workspace' : shared || legacy || hash === '#participant' ? 'participant' : hash === '#evidence' ? 'evidence' : 'workspace';
  const phase = context && ['prepare','collect','understand','improve'].includes(selected) ? selected : 'prepare';
  return {route,phase,staff};
}
export function mountStageComposition(doc,win) {
  const identity=doc.getElementById('identity');
  const tabs=doc.getElementById('stage-tabs-root');
  const workspace=doc.getElementById('stage-workspace');
  const facilitator=doc.getElementById('facilitator');
  const explicitSharedAtEntry=parseEntryFragment(win.location.hash)!==null;
  function render() {
    // An explicit #invite= page load is isolated for its whole lifetime: leftover participant storage never becomes a
    // route, before or after the invitation intent ends (Bugbot 4039886032). Storage itself is untouched.
    const isolated=doc.body.dataset.invitationEntry==='true';
    const state=compositionState({
      invitation:doc.body.dataset.invitationIntent==='active',
      shared:explicitSharedAtEntry || (!isolated && currentNamespace(win.sessionStorage)!==null) || facilitator.hidden,
      legacy:!isolated && !!win.sessionStorage.getItem('participantToken'),
      staff:observedIdentity(identity),hash:win.location.hash,
      context:!workspace.hidden,
      selected:tabs.querySelector('[role="tab"][aria-selected="true"]')?.dataset.stage,
    });
    doc.body.dataset.workspaceRoute=state.route;
    doc.body.dataset.workspacePhase=state.phase;
    doc.body.dataset.staffConfirmed=String(state.staff);
  }
  const observer=new win.MutationObserver(render);
  observer.observe(doc.body,{attributes:true,attributeFilter:['data-invitation-intent']});
  observer.observe(identity,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-signed-in']});
  observer.observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected']});
  observer.observe(workspace,{attributes:true,attributeFilter:['hidden']});
  observer.observe(facilitator,{attributes:true,attributeFilter:['hidden']});
  // Participant redemption/recovery can change without a hash or identity update.
  observer.observe(doc.getElementById('participant'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  win.addEventListener('hashchange',render);
  render();
}
if(typeof document!=='undefined')mountStageComposition(document,window);
