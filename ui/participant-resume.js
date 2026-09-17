// A participant token reopens the server-backed survey. Answers are never
// cached in browser storage; only the token and an in-flight submit key are.
export function resumeTarget(receipt) {
  return receipt?.submitted ? 'receipt' : 'form';
}

export function savedSubmitKey(storage, participantToken) {
  return participantToken ? storage.getItem('responseKey') : null;
}
