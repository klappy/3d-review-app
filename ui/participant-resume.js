// A participant token reopens the server-backed survey. Answers are never
// cached in browser storage; only the token and an in-flight submit key are.
export function resumeTarget(receipt) {
  return receipt?.submitted ? 'receipt' : 'form';
}

export function savedSubmitKey(storage, participantToken) {
  return participantToken ? storage.getItem('responseKey') : null;
}

export function resumeNoticeAfterReceipt(receipt, previous) {
  return receipt?.submitted === false ? previous : '';
}

// A one-time code can be consumed before the form request fails. Only a failed
// redeem is a bad code; later form failure must leave the saved token usable.
export async function redeemAndOpen(redeem, onRedeemed, openForm, onRedeemFailure) {
  let result;
  try { result = await redeem(); }
  catch (error) { onRedeemFailure(error); throw error; }
  onRedeemed(result);
  await openForm();
}

// Retry an unopened form without discarding answers in an already open form.
export async function recoverParticipant(receipt, hasForm, openForm, showReceipt) {
  if (receipt.submitted === false && !hasForm) await openForm();
  else showReceipt(receipt);
}
