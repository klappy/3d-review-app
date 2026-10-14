# Real project language entry

Compatible fix candidate. Release version/pin remains owned by the release train.

Before a new assessment is first saved, an existing project's Language selector now offers **Add language…**, using the same inline name and optional code fields as a new project. The saved assessment links to the returned language identity. Resumed saved drafts retain existing-language selection; creation from resumed draft editing is outside this increment.

Codes accept case-insensitive 2–3-letter primary subtags with the existing optional hyphenated subtags (for example ORY or or-Orya-IN), and new codes are stored lowercase. Blank codes are allowed for named languages whose identifier is unknown. Duplicate comparison includes legacy mixed-case codes. This is shape checking, not a language catalog or full BCP47 registry validation. No migration or project-cardinality change occurs.

Project language identity remains distinct from the existing supported survey translation list. Adding a project language does not claim machine translation support for it.

Lost first-save responses preserve the chosen identity and reconcile before another write. A definite assessment refusal retains a successfully created language and leaves review fields editable.

Local evidence: 73 wizard Node tests passed, language API integration test passed (case normalization, script/custom/blank codes, duplicate legacy codes, assessment links, archive/undo and authorization), TypeScript check passed. These are automated fixture results, not Bincy's reproduction or a real-user study. Exact reporter input remains unknown. Satisfaction/confusion/frustration NOT MEASURED. Independent review, 390×844 and 1280×800 visual review, release identity and DEV validation remain pending.
