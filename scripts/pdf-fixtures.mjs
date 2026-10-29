// Local synthetic output only; invokes no application server, credentials, data store or remote renderer.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {surveyPdfDocument,reportPdfDocument} from '../ui/pdf/documents.js';
import {paperLink} from '../ui/assess/print.js';
const out=resolve(process.argv[2]||'/tmp/3d-pdf-fixtures');mkdirSync(out,{recursive:true});
const identity={project:{id:'project_fixture',name:'Synthetic QA project'},assessment:{id:'assessment_fixture',name:'Mark 4 review',language:'Hindi'},survey:{id:'survey_fixture',name:'Community',perspective:'Community'}};
const english={visible:true,blank:true,title:'Community survey',identity,passageLine:'Before you answer, read or listen to: Mark 4:1-9',link:paperLink({url:'https://example.invalid/#survey=synthetic-fixture'}),items:Array.from({length:18},(_,i)=>({type:i%4===0?'multi':'single',text:`${i+1}. Is the meaning of this passage clear to people in your community?`,options:[{text:'Yes, the meaning is easy to understand.'},{text:'Some parts are clear; other parts need explanation.'},{text:'No, the meaning is difficult to understand and the translation needs more work.'}]}))};
const hindi={...english,title:'समुदाय सर्वेक्षण',lang:'hi',language:'Hindi',items:english.items.map((it,i)=>({...it,text:`${i+1}. क्या इस अंश का अर्थ आपके समुदाय के लोगों के लिए स्पष्ट है?`,options:[{text:'हाँ, अर्थ समझना आसान है।'},{text:'कुछ भाग स्पष्ट हैं; अन्य भागों को समझाने की आवश्यकता है।'},{text:'नहीं, अर्थ समझना कठिन है और अनुवाद पर और काम करने की आवश्यकता है।'}]}))};
const corpus=JSON.parse(readFileSync(new URL('../test/fixtures/synthetic-report-renderer-v1.json',import.meta.url)));
const payload={...corpus.contexts['assess_syn_earning-trust-2026-01'],source_commit:corpus.source_commit,versions:{scorer:'fixture',narrative:'fixture',policy:'fixture'}};
const files={'survey-en-letter':surveyPdfDocument(english),'survey-hi-a4':surveyPdfDocument(hindi,{paper:'a4'}),'report-letter':reportPdfDocument({suppressed:false,report:{id:'synthetic_fixture',created_at:'2026-10-29T12:00:00Z',payload}})};
for(const [name,html]of Object.entries(files))writeFileSync(`${out}/${name}.html`,html);
writeFileSync(`${out}/source-report.json`,JSON.stringify(payload,null,2));
console.log(out);
