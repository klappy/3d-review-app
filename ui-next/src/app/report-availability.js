// Read-only interpretation of the already displayed results model. No requests, report builds, or access inference.
export function reportAvailability(model){
 const review=model?.review??{},n=review.liveResponses;
 const context=[review.project,review.title].filter(v=>typeof v==='string'&&v.trim()).join(' · ');
 if(model?.payload||model?.reportId)return {kind:'saved',context,message:'A saved report is available.'};
 const count=typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:null;
 const known=count!==null;
 const message=known&&count>0?`${count} collected ${count===1?'response is':'responses are'} recorded, but no saved report is available for this review.`:known?'No collected responses or saved report are recorded for this review.':'A saved report is not available. The collected-response total could not be confirmed.';
 const guidance=model?.canBuild===true?'You can explicitly build a saved report from the collected responses. Opening this page does not build one.':'Report building is not currently available here. An authorized owner or member can check the reporting requirements.';
 return {kind:model?.results?.error?'unavailable':model?.held?'held':known?(count>0?'data-present':'empty'):'unknown',context,message,guidance,...(known?{responses:count}:{})};
}
