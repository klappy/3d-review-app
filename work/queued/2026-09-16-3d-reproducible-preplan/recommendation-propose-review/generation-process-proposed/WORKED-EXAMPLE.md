# Worked illustration — locally authored, unregistered, unreviewed

This complete planning example uses actual immutable synthetic fixture values. It is not an execution of a production generator, persisted recommendation or human decision. The exact runtime serving-model identifier is unavailable to this author; no external model/vendor call was made. The assistant authored the example in this task under the proposed constraints. Prompt identity is recorded separately and does not imply that a production system executed it.

## Exact source and allowed-input envelope

App `e5b32a5e39becc3e8209fe5caed4b34c82c04d29`, file `test/fixtures/synthetic-report-renderer-v1.json`, context `assess_syn_earning-trust-2026-01`; underlying gold source `f042cde553761a6a7f24132cef7802f956378ee0`. Full identities are in PROVENANCE.json. The following JSON block including its trailing newline is the exact input envelope used for this planning illustration. Evidence pointer indices refer to that immutable fixture, not an evolving current report. The source fixture's entire context was inspected; only these permitted aggregate fields are selected. No runtime report ID exists for this example.

```json
{
  "synthetic": true,
  "assessment_id": "assess_syn_earning-trust-2026-01",
  "source_commit": "f042cde553761a6a7f24132cef7802f956378ee0",
  "evidence": [
    {
      "id": "E1",
      "pointer": "/contexts/assess_syn_earning-trust-2026-01/cross_lens_multi/0",
      "value": {
        "construct_code": "translation-brief-alignment",
        "construct_name": "Brief Process & Perceived Fidelity",
        "triangulated_mean": 62.625,
        "agreement_range": 25.25,
        "n_lenses_included": 2,
        "lens_scores": [
          {
            "lens": "Church",
            "score": 50.0
          },
          {
            "lens": "Translation Team",
            "score": 75.25
          }
        ]
      }
    },
    {
      "id": "E2",
      "pointer": "/contexts/assess_syn_earning-trust-2026-01/evidence",
      "value": [
        {
          "form_type": "CHIP",
          "label": "Church — Involved Pastor",
          "n": 2
        },
        {
          "form_type": "CW",
          "label": "Community — Written",
          "n": 6
        },
        {
          "form_type": "TR",
          "label": "Translation Team — Translator / Validation",
          "n": 4
        }
      ]
    },
    {
      "id": "E3",
      "pointer": "/contexts/assess_syn_earning-trust-2026-01/cross_lens_single/0",
      "value": {
        "construct_code": "consistency",
        "construct_name": "Consistency",
        "triangulated_mean": 81.25,
        "agreement_range": null,
        "n_lenses_included": 1,
        "lens_scores": [
          {
            "lens": "Translation Team",
            "score": 81.25
          }
        ]
      }
    },
    {
      "id": "E4",
      "pointer": "/contexts/assess_syn_earning-trust-2026-01/standalone_indicators",
      "value": []
    }
  ]
}
```

## Authored draft output

The numeric agreement range is copied from the fixture, not calculated as a new intervention rule. E1 is a construct comparison, not the overall lens score; E3 is a different single-lens construct and must not be substituted for a full lens score. The options remain subject to human judgment.

```json
{
  "title": "Questions to explore the reported perspectives",
  "entries": [
    {
      "evidence_refs": [
        {
          "id": "E1",
          "pointer": "/contexts/assess_syn_earning-trust-2026-01/cross_lens_multi/0",
          "value": {
            "construct_code": "translation-brief-alignment",
            "construct_name": "Brief Process & Perceived Fidelity",
            "triangulated_mean": 62.625,
            "agreement_range": 25.25,
            "n_lenses_included": 2,
            "lens_scores": [
              {
                "lens": "Church",
                "score": 50.0
              },
              {
                "lens": "Translation Team",
                "score": 75.25
              }
            ]
          }
        },
        {
          "id": "E2",
          "pointer": "/contexts/assess_syn_earning-trust-2026-01/evidence",
          "value": [
            {
              "form_type": "CHIP",
              "label": "Church — Involved Pastor",
              "n": 2
            },
            {
              "form_type": "CW",
              "label": "Community — Written",
              "n": 6
            },
            {
              "form_type": "TR",
              "label": "Translation Team — Translator / Validation",
              "n": 4
            }
          ]
        }
      ],
      "observation": "For Brief Process & Perceived Fidelity, the Church construct score is 50.0 and the Translation Team construct score is 75.25; the report records an agreement range of 25.25. Evidence coverage lists 2 Church — Involved Pastor submissions, 6 Community — Written submissions and 4 Translation Team — Translator / Validation submissions.",
      "question": "What context would help you interpret the different Church and Translation Team perspectives on Brief Process & Perceived Fidelity?",
      "optional_next_step": "If useful, discuss this report section with the relevant authorized reviewers, keeping the two perspectives visible and recording questions that the report leaves unanswered. You may also decide that no follow-up is needed.",
      "uncertainty": "The aggregate values do not identify the cause of the difference, show how representative the submissions are, or establish that either perspective is correct. Form submission counts do not establish unique people."
    },
    {
      "evidence_refs": [
        {
          "id": "E3",
          "pointer": "/contexts/assess_syn_earning-trust-2026-01/cross_lens_single/0",
          "value": {
            "construct_code": "consistency",
            "construct_name": "Consistency",
            "triangulated_mean": 81.25,
            "agreement_range": null,
            "n_lenses_included": 1,
            "lens_scores": [
              {
                "lens": "Translation Team",
                "score": 81.25
              }
            ]
          }
        },
        {
          "id": "E4",
          "pointer": "/contexts/assess_syn_earning-trust-2026-01/standalone_indicators",
          "value": []
        }
      ],
      "observation": "Consistency has one included lens, Translation Team, with a reported value of 81.25; agreement_range is null. The standalone_indicators array has no entries.",
      "question": "What limitations should accompany discussion of this single-lens Consistency result?",
      "optional_next_step": "If useful, add a review note that this construct is not compared across lenses in this report; keep any request for additional evidence separate from this draft and within existing permissions. No new collection is required by this suggestion.",
      "uncertainty": "Null agreement is not zero or perfect agreement. No standalone-indicator entries does not prove there are no concerns. This snapshot cannot justify a trend, quality certification or intervention."
    }
  ],
  "limitations": [
    "This is synthetic single-assessment planning evidence, not a real-world diagnosis.",
    "These are newly authored proposed questions/options, not Steve-authored recommendations or preapproved interventions.",
    "No raw answers, participant identities, prior cycles, causal evidence or human decision are supplied."
  ]
}
```

## Walk through the proposed user journey

The assistant prepares the above draft and exposes evidence E1–E4. In a real accepted implementation, an authorized O/M would register it against an actual immutable eligible report. The server would return the real proposal identity/status and protected provenance. Here persistence is **not executed**, proposal ID is absent, status is **planning illustration of proposed content**, and no acceptance receipt exists.

An authorized human would discover and reopen the persisted item in 3D Review, read the evidence and limits, then explicitly accept or reject with their own reason. No reviewer/time/reason is fabricated for this example. A reviewer could reject the optional discussion as unhelpful without disputing the copied values; revision would be a new draft. Until an actual accepted human decision and audience checks exist, none of this is accepted end-user advice.

## Author checks, not independent acceptance

Every evidence value was extracted from the exact committed fixture; pointers resolve to equal values. PROMPT.md and the exact input/output JSON blocks have SHA-256 identities in PROVENANCE.json. Numeric literals in the prose match cited copied fields; there is no score pooling or forecast. The illustration exercises null agreement and empty projection limits. It does not prove runtime authorization, registration, model attribution, idempotency, human confirmation or UI reload behavior. Those remain implementation acceptance obligations.
