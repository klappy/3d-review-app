// Synthetic models only. No real identities, tokens or transport.
export function fixture(role='owner') {
 const survey={id:'s1',kind:'survey',label:'Translation Team',href:'#assessment/a1/survey/s1',visible:true,detail:'12 responses'};
 const a={id:'a1',kind:'assessment',label:'September assessment',detail:'September · Understanding',href:'#assessment/a1/understand',visible:true,role:role==='owner'?'Owner':role==='viewer'?'Viewer':'Member',children:[survey]};
 const p={id:'p1',kind:'project',label:'River Valley',href:'#project/p1',visible:true,children:[a]};
 const w={id:'w1',kind:'workspace',label:'Field team',href:'#workspace/w1',visible:true,role:'Owner',children:[p]};
 const direct=['direct','viewer'].includes(role);
 return {context:{identity:role,assessment:'a1',epoch:1},identityLabel:{owner:'Miriam',member:'Shojo',viewer:'Rina',direct:'Amos'}[role],role:role==='owner'?'Owner':role==='viewer'?'Viewer':'Member',sample:true,title:'September assessment',eyebrow:'Assessment',currentHref:a.href,expanded:['w1','p1','a1'],sectionLabel:direct?'Shared with you':role==='member'?'Projects':'Workspaces',nodes:direct?[a]:role==='member'?[p]:[w],ancestors:direct?[a]:role==='member'?[p,a]:[w,p,a],actions:[{id:'people',label:'People & access',allowed:role!=='viewer'},{id:'rename',label:'Rename assessment',allowed:role==='owner'}]};
}
