import {parseEntryFragment,currentNamespace} from './shared-link.js';

// Screen selection only. Authorization and all writes remain in the existing app.
export function publicView({shared,authenticated,checking=false,participantResume=false,hash}) {
  if(shared||authenticated||checking||participantResume)return 'workspace';
  if(hash==='#how')return 'how';
  if(hash==='#example')return 'example';
  if(['#facilitator','#participant','#reports-card','#workspace','#evidence'].includes(hash))return 'workspace';
  return 'home';
}
export function observedIdentity(text) {
  return typeof text==='string' && text.includes(' · ') && !['Checking session…','Not signed in'].includes(text);
}
export function mountPublicEntry(document,window) {
  const identity=document.getElementById('identity');
  const sharedAtEntry=parseEntryFragment(window.location.hash)!==null || currentNamespace(window.sessionStorage)!==null;
  function render(){
    const shared=sharedAtEntry||document.getElementById('facilitator')?.hidden===true;
    // Presence selects the existing recovery screen only; restoreParticipant still validates the session.
    const participantResume=!shared && !!window.sessionStorage.getItem('participantToken');
    const view=publicView({shared,participantResume,authenticated:observedIdentity(identity?.textContent),checking:identity?.textContent==='Checking session…',hash:window.location.hash});
    document.body.dataset.entryView=view;
    for(const name of ['home','how','example'])document.getElementById('public-'+name).hidden=view!==name;
    document.getElementById('public-entry').hidden=view==='workspace';
    // Unauthenticated report entry reaches real sign-in, never a sample report or implied grant.
    if(view==='workspace'&&!shared&&!observedIdentity(identity?.textContent)&&window.location.hash==='#reports-card')document.getElementById('facilitator').scrollIntoView();
  }
  window.addEventListener('hashchange',render);
  new window.MutationObserver(render).observe(identity,{childList:true,subtree:true,characterData:true});
  new window.MutationObserver(render).observe(document.getElementById('facilitator'),{attributes:true,attributeFilter:['hidden']});
  document.querySelectorAll('[data-tour-step]').forEach(button=>button.addEventListener('click',()=>{
    const step=Number(button.dataset.tourStep);
    document.querySelectorAll('[data-tour-panel]').forEach(panel=>panel.hidden=Number(panel.dataset.tourPanel)!==step);
    document.querySelectorAll('.public-progress span').forEach((pip,index)=>pip.classList.toggle('done',index<=step));
    document.querySelector(`[data-tour-panel="${step}"] h1`)?.focus();
  }));
  render();
}
if(typeof document!=='undefined')mountPublicEntry(document,window);
