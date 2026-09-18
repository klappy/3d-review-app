import {parseEntryFragment,currentNamespace} from './shared-link.js';

export function parseInvitationFragment(hash) {
  if(typeof hash !== 'string' || !hash.startsWith('#invite=') || hash.length > 4104)return null;
  try { const token=decodeURIComponent(hash.slice(8)); return /^[A-Za-z0-9_-]{1,4096}$/.test(token) ? token : null; } catch { return null; }
}
// Screen selection only. Authorization and all writes remain in the existing app.
export function publicView({shared,authenticated,checking=false,participantResume=false,invitation=false,hash}) {
  if(invitation)return 'workspace';
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
  const explicitSharedAtEntry=parseEntryFragment(window.location.hash)!==null;
  function render(){
    if (['#how', '#example'].includes(window.location.hash)) { window.location.replace('/?demo=1#assessment/demo-assessment/prepare'); return; }
    const invitation=document.body.dataset.invitationIntent==='active';
    const isolated=document.body.dataset.invitationEntry==='true'; // explicit invite load: saved participant route ignored for the page lifetime (Bugbot 4039886032)
    const shared=!invitation&&(explicitSharedAtEntry||(!isolated&&currentNamespace(window.sessionStorage)!==null)||document.getElementById('facilitator')?.hidden===true);
    // Presence selects the existing recovery screen only; restoreParticipant still validates the session.
    const participantResume=!shared && !isolated && !!window.sessionStorage.getItem('participantToken');
    // Access return paints Not signed in and clears #session= before /v2/me; a stored token is still restoring.
    const view=publicView({invitation,shared,participantResume,authenticated:observedIdentity(identity?.textContent),checking:identity?.textContent==='Checking session…'||(!!window.sessionStorage.getItem('facilitatorToken')&&!observedIdentity(identity?.textContent)),hash:window.location.hash});
    document.body.dataset.entryView=view;
    for(const name of ['home','how','example'])document.getElementById('public-'+name).hidden=view!==name;
    document.getElementById('public-entry').hidden=view==='workspace';
    // Unauthenticated report entry reaches real sign-in, never a sample report or implied grant.
    if(view==='workspace'&&!shared&&!observedIdentity(identity?.textContent)&&window.location.hash==='#reports-card')document.getElementById('facilitator').scrollIntoView();
  }
  // "Sign in" from the public choices: land keyboard and viewport on the real sign-in control, not the card heading.
  // Presentation only — the hash, the view and the auth flow are unchanged.
  function landOnSignIn(){
    if(window.location.hash!=='#facilitator'||observedIdentity(identity?.textContent))return;
    const link=document.querySelector('#facilitator a[href="/v2/auth/access"]');
    if(!link)return;
    link.scrollIntoView?.({block:'center'});
    link.focus?.({preventScroll:true});
  }
  window.addEventListener('hashchange',()=>{render();landOnSignIn();});
  new window.MutationObserver(render).observe(document.body,{attributes:true,attributeFilter:['data-invitation-intent']});
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
