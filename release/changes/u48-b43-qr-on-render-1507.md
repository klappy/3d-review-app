bump: patch
lane: 3d-sprint-s6d-fix-b43 · PR: (below)
- Fixed - On Collect, each survey's share card now shows its QR code as soon as the card appears: the participant link is made when the card renders (captain ruling 2026-09-28 14:42 ET, k0013 "Mint the link on render so QR shows immediately"). One link per survey still holds: a survey whose link is already active (launch page, an earlier visit, the survey's Share card) reuses it. Copy link and Print keep working; "Print all" is unchanged (window.print()).
