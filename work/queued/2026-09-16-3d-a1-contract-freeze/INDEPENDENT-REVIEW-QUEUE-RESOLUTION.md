# Independent planning review — first shared-link collection slice

Reviewer /root/queue_resolution; no authorship of shared-link plan or product implementation. Read complete proposed plan including governing per-sprint amendment and pinned source auth/participant/response/dispatch/receipt/ui paths. Scope: staff setup/select/open/copy link → two independent anonymous submissions → staff counts+2. Deadline is a target.

Verdict AMEND narrow, not a new backlog. No implementation fire yet.

1. Defer Next-person activation from this firstslice. Keep existing assisted_next refusal as explicitly unfinished; remove next_respondent_id column/CAS, successor issuance, Nextbutton and successororacle from thisorder. It is unnecessary to the accepted independentbrowsercontexts journey and adds another concurrency/privacy lifecycle. This does not waive eventual assistedcollection requirement.
2. Fix sessionidentity specification. Baseline auth.ts participant_session resolution returns respondent/survey but no sessionTokenHash. The proposed helper cannot identify a presented credential among multiple same-respondent rows. With Nextdeferred, require exactlyone shared-session row per freshlyrandomrespondent, resume returns sameexistinglive token withoutrotation/reissue, helper rejects ambiguousassociation; legacyNULL rows retain existingsemantics. If design needs multiplebearers, first seek narrowAuthowned tokenhash handoff; do not quietly edit auth.ts.
3. Enumerate touchedcapability definitions explicitly: survey.issue_link, participant.open_link, response.form, response.submit, response.receipt. assisted_next staysunchanged. Chosen issue_link class/disclosure change still needs actualA1owneracceptance, and currentrequiredcookie/MCPsecurity controlsremain.
4. Existing ui/app.js writes participantToken/responseKey globals duringredeem/loadForm/submit/recover. Sharedmode requires namespacedstorageadapter across ALLthose paths, not merelyopen; existing legacyflow retainedseparately. All shared-mode participationfetches must credentialsomit and only sharedcontextbearer, never staffcredentialfallback. Add explicit staleglobaltoken/key negativeoracle and reloadfailureproof. No newidentityrequirement.
5. Final integration must refresh source-firstfullcontentoverlay baseline. Old10f5 full-fileoutput cannot safely overlay acceptedAuthbase. Re-pin exactbaseline/hashmanifest, resolveonlyownedhunks retainingotherowners, regenerate14outputs and repeatintegrationbytecompare. Oldbaselineproof remainsattributed, not finalAuthcompatibility.

Sound within remaining ownergates: response INSERT conditionaloncurrentauthority plus claimINSERT inone D1batch with uniqueclaimrollback; exactkey/normalizedpayload replay checks and changedkeyconflict; link/sessionexpiry/revoke checks; no receiptlookupbylinkonly; per-linksessionStorage and serverattribution; explicitcollectiontransition; no participantaccount/code; independentbaselinefailurecontrol, concurrencytests and browsercount+2oracle. Actualimplementationmust prove these, no guaranteesfromprose.

Pending beforefire: A1class/disclosureacceptance, Designstatesacceptance, migration0007reservationACK, API/UIcustody/realworkers, materializednormativeschemas/source-firstmanifest, exactNode/Python/browseravailabilityACK, scopeddriverseat/gates and acceptanceofthisAMEND. These are concrete existingownerreturns, not newhuman-onlydecisions.

Python3.11.2stdlibmanifestprojection is acceptable as deterministic14outputsource, withfullcontent review and strictpath/hashchecks. It does not reconstruct unrelatedbaseline117files or provewholeapprebuildability. No implementation/sharedjournal/providerchanges performed.

## Final amended-plan review

Verdict: ACCEPT AS BOUNDED PLAN, not FIRE. Re-read governing final independent-review-resolution section and per-sprintscope. AllfiveAMEND points addressed: Nextdeferred; unique sharedsession invariant+exactresume+ambiguousassociationrefusal; exactfivecapabilityIDs; namespacedallstorage/fetches and staleglobalnegativeoracle; integrationbaserepin+source-first14outputregeneration. Root explicitlyacceptsNextdeferral.

Reviewed complete plan SHA256 fe706b7d7acea1752d02646b3369d4e9f9e135e01bc95ded452da1f181c7da2b. Owner/class/Design/migrationreservation/runtimeavailabilityACK and actualworkerbudget stillpending asdocumented. Theseare explicitprefireinputs, not fatalremainingplandesignAMEND or permission to skip them. No newfeature/backlog requested. No guarantee01:00deadlinefeasibility, no implementation or acceptanceclaim.

Final hash refresh ACCEPT: 9e7f444461c0d5d23167cb9989e0b7eedc89baa9d76823aac87f5de85aa8d94f. Read exact appended DDL and canonical-digest/key algorithm; verified existing receipt.ts exports canonical. Partial unique session association and sharedclaim primary/uniqueFK correspond to accepted invariant. Explicit verify--baseline validates per-pathhashes without projectorGit calls; reviewer proves checkoutidentity separately. No semanticextension, pendingowner/firegates unchanged.

## Impact-only final amendment review

ACCEPT amended bounded plan, exact SHA256 bd883b0624eee1f369761baadf17d2a4fd5262eac333ead2d144958641872920. Reviewer/root/queue_resolution read finalthreeamendments against previouslyaccepted core9e7f4444; noauthoring. Reconstructionaftership implements explicitusersequencingwhile retainingcurrentessentialcontracts/migration/runtime/tests/independentreview/checks. Actual55–75minuteAPIbudget honest; no01:00promise. ParallelC2fourfilesfromsame10f5usingexactfixtures avoidsunnecessarywait, while schemaownerreconciliation and actualintegratedtwo-browser/D1/count+2proof remainmandatory. Backendfire separatedfromsprintcompletion; nofakeUIACK. Authclass/reservation/correctedfiveIDs/Designreceipts attributedtorootreadback andmustaccompanyfire. Protectedpaths preventAuthduplication.

NoadditionalAMEND. This is independentimpactplanningACCEPT, notclaimallwrittenfiregateslandedorimplementationcomplete. Rootcanland/fireexistingAPIworkerafteractualrequiredreadbacks/gates; no provider/productionauthority.
