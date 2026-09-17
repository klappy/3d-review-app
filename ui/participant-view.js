// Source-shaped presentation only: no API, storage, credential or submission ownership.
export function itemError(item, values) {
  const value = item.type === 'multi' ? values.getAll(item.id) : values.get(item.id);
  const empty = value === null || value === '' || (Array.isArray(value) && !value.length);
  if (empty && item.required !== false) return `Answer required: ${item.text || item.id}`;
  if (item.type === 'multi' && Array.isArray(value) && value.length > 1 && (item.options || []).some(opt => opt.exclusive && value.includes(opt.code))) return `An exclusion choice cannot be combined: ${item.text || item.id}`;
  return null;
}

export function mountParticipantView({doc,root,form,questions,review,reviewAnswers,receipt,context,model,onEdit,reviewButton}) {
  const fields = [...questions.children];
  const items = model?.items;
  if (!Array.isArray(items) || !items.length || fields.length !== items.length || fields.some((f,i)=>f.dataset.item !== items[i].id)) throw new Error('Participant item/fieldset mismatch');
  const candidates = [...form.querySelectorAll('button')].filter(b=>b.type === 'submit');
  const originalReview = reviewButton || (candidates.length === 1 ? candidates[0] : null);
  if (!originalReview || !form.contains(originalReview) || originalReview.type !== 'submit') throw new Error('Original Review submit button required');
  const initialHidden = fields.map(f=>f.hidden);
  let index=0, destroyed=false, validatingItem=false;
  const owned=[];
  const changes=[];
  function el(tag,text) {const n=doc.createElement(tag);if(text!==undefined)n.textContent=String(text);return n;}
  function button(label,action) {const n=el('button',label);n.type='button';n.addEventListener('click',action);return n;}
  const intro=el('section');intro.className='participant-intro';
  intro.append(el('h2','Here to take the survey?'));
  const labels=[model.assessment,model.language,model.period,model.template?.perspective].filter(v=>v!==null&&v!==undefined&&v!=='');
  if(labels.length)intro.append(el('p',labels.join(' · ')));
  intro.append(el('p',`${items.length} questions`));
  if(model.template?.source_ref)intro.append(el('p',model.template.source_ref));
  intro.append(button('Begin',()=>showForm(0)));
  const nav=el('div');nav.className='participant-pager';nav.hidden=true;
  const progress=el('p');progress.className='participant-progress';progress.setAttribute('aria-live','polite');
  const controls=el('div');controls.className='participant-page-actions';
  const back=button('Back',()=>showForm(Math.max(0,index-1)));
  const next=button('Next',()=>{if(validItem(index))showForm(index+1);});
  controls.append(back,next);nav.append(progress,controls);
  const error=el('p');error.className='participant-page-error';error.setAttribute('role','alert');error.hidden=true;
  root.append(intro,nav,error);owned.push(intro,nav,error);
  function values(){return new doc.defaultView.FormData(form);}
  function focusField(i){const legend=fields[i].querySelector('legend');if(legend){legend.tabIndex=-1;legend.focus();}else fields[i].querySelector('input,textarea,select')?.focus();}
  function showForm(i=index) {
    if(destroyed)return;
    index=Math.max(0,Math.min(items.length-1,i));
    fields.forEach((f,k)=>f.hidden=k!==index);
    intro.hidden=true;nav.hidden=false;error.hidden=true;
    progress.textContent=`Question ${index+1} of ${items.length}`;
    back.disabled=index===0;next.hidden=index===items.length-1;
    focusField(index);
  }
  function revealAll(){fields.forEach(f=>f.hidden=false);}
  function validItem(i){
    const message=itemError(items[i],values());
    if(message){showForm(i);error.textContent=message;error.hidden=false;fields[i].querySelector('input,textarea,select')?.focus();return false;}
    validatingItem=true;
    try {
      for(const input of fields[i].querySelectorAll('input,textarea,select'))if(!input.checkValidity()){showForm(i);input.reportValidity();return false;}
      return true;
    } finally { validatingItem=false; }
  }
  function beforeReview(event){
    for(let i=0;i<items.length;i++)if(!validItem(i)){event.preventDefault();event.stopImmediatePropagation();return;}
    revealAll(); // native submit and the existing app handler remain the sole review path
  }
  function onInvalid(){if(validatingItem)return;revealAll();intro.hidden=true;nav.hidden=false;}
  originalReview.addEventListener('click',beforeReview,true);
  form.addEventListener('invalid',onInvalid,true);
  fields.forEach(field=>field.hidden=true);
  function removeChanges(){for(const n of changes)n.remove();changes.length=0;}
  function showReview(){
    intro.hidden=true;nav.hidden=true;error.hidden=true;removeChanges();
    const rows=[...reviewAnswers.children];
    if(rows.length!==items.length)return;
    rows.forEach((row,i)=>{const change=button('Change',()=>{onEdit?.(i);showForm(i);});change.className='participant-change';row.append(change);changes.push(change);});
  }
  function showReceipt(){intro.hidden=true;nav.hidden=true;error.hidden=true;removeChanges();}
  function reset(){index=0;revealAll();removeChanges();intro.hidden=false;nav.hidden=true;error.hidden=true;}
  function destroy(){if(destroyed)return;destroyed=true;originalReview.removeEventListener('click',beforeReview,true);form.removeEventListener('invalid',onInvalid,true);removeChanges();owned.forEach(n=>n.remove());fields.forEach((f,i)=>f.hidden=initialHidden[i]);}
  // Caller controls #answers/#review/#receipt; the component never changes their flags.
  return {showForm,showReview,showReceipt,reset,destroy};
}
