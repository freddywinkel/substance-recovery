# Anchor qualified content review packet

Status: **PENDING QUALIFIED HUMAN REVIEW**

### Personal growth extension — 8 October 2026

New review scope: `src/lib/growthCopy.ts`, `src/pages/GrowthMoment.tsx`,
`src/pages/MyGrowth.tsx`, `src/tools/BriefSelfCompassion.tsx` and their Home and
completed-registration entry points. Dutch and English content remains pending
qualified human review. No clinical approval is inferred from software tests.

Phase 2 adds `src/lib/weeklyGrowthCopy.ts`, `src/pages/WeeklyReview.tsx`,
`src/lib/selfCriticismCopy.ts` and `src/pages/SelfCriticism.tsx` to this scope.
Review the optional weekly prompts and enjoyable-activity framing, the explicit
self-criticism entry and support choices, and the absence of inferred diagnoses,
mandatory positive feelings or automatic contact. The existing pattern/plan
workflow remains optional alongside reflection without problem registrations.

Review boundaries: optional everyday reflection and self-kindness, no validated
assessment or treatment protocol, no prescribed exercise duration or promise of
symptom reduction, no automatic inference from free text, no forced positivity,
and no replacement or suppression of urgent support. Users may stop or skip,
choose a practical action instead of words, and need not feel warmth or believe
a suggested phrase. Only explicitly selected moments are shown on Home.

Packet version: 1.1
Prepared: 2026-08-02; extended 2026-09-08
Product content version: `registration-v3` with optional use-details extension; clinical-copy revision 2026-09-08
Languages in scope: English and Dutch

This packet is a controlled hand-off for an independent, qualified human review.
Automated tests, source checks, and AI-assisted wording review can find product and
consistency defects, but they do not establish clinical validity or clinical
approval. Anchor must continue to describe itself as cautious self-help software
until the sign-off section is completed by the appropriate reviewer or reviewers.

Even a completed content review is limited to the scope recorded by the reviewer.
It does not establish treatment efficacy, clinical validation, medical-device
approval, or permission to make medical claims beyond that recorded scope.

## Reviewer record

Complete every field. `PENDING` is not a signature.

| Field | Required entry |
| --- | --- |
| Clinical reviewer name | PENDING |
| Professional credential and registration number | PENDING |
| Relevant addiction / mental-health expertise | PENDING |
| English review competence | PENDING |
| Dutch review competence, or separate Dutch reviewer | PENDING |
| Scope actually reviewed | PENDING |
| Review date | PENDING |
| Decision | PENDING — choose APPROVE, APPROVE WITH RECORDED LIMITATIONS, or REVISE |

If one person cannot review both clinical meaning and Dutch/English equivalence,
record two reviewers. A translation-only reviewer cannot approve clinical content,
and a clinical reviewer who cannot assess both languages cannot approve bilingual
equivalence alone.

## Product boundary to verify

Anchor is an offline self-reflection and coping companion. It does not diagnose,
assess whether symptoms are medically safe, provide treatment, replace emergency or
crisis care, or prove that a selected coping action caused a later outcome. The
reviewer should reject wording or interaction logic that crosses this boundary.

## Review inventory

Review the rendered English and Dutch experience as well as the source text. Record
every requested change in the issue log below.

| Area | Files / rendered paths | Required review |
| --- | --- | --- |
| Registration questions and answer labels | `src/pages/TrekTracker.tsx`, `CravingTracker.tsx`, `AnxietyTracker.tsx`, `BoredomTracker.tsx`, `RelapseLog.tsx`, `src/lib/translations.ts` | Neutrality, comprehension, stigma, answer completeness, operational versus diagnostic language, EN/NL equivalence |
| Immediate safety routing | `src/lib/registrationSafety.ts` and every branch that calls it | Correct distinction between 112, 113, configured local support, and non-emergency medical/addiction help; no false reassurance |
| Relapse acute concerns | `src/pages/RelapseLog.tsx` | Multi-concern combinations, `none` exclusivity, unanswered handling, target-aware withdrawal/overdose wording, and multiple simultaneous routes |
| Anxiety caveat | `src/pages/AnxietyTracker.tsx` | New, severe, different, or medically concerning symptoms; independence from the selected coping response |
| Substance warnings | `src/lib/registrationSafety.ts` | Withdrawal, tolerance loss, overdose, mixing substances, naloxone limitations, and target-specific applicability |
| Outcome and Insights language | `src/pages/*Tracker.tsx`, `src/pages/RelapseLog.tsx`, `src/components/RegistrationHistory.tsx`, `src/pages/Insights.tsx` | No diagnosis, invented severity, causal effectiveness, or hidden interpretation of unanswered values |
| Coping tools and timers | `src/pages/Tools.tsx`, tool components, `src/lib/translations.ts` | Contraindications, duration claims, instructions, exit routes, and claims of effect |
| Historical intervention notes | `docs/INTERVENTIONS.md` | Every origin, mechanism, duration, contraindication, and effectiveness statement before any reuse as user-facing copy |
| Product boundary and disclaimers | `docs/DESIGN_PRINCIPLES.md`, `docs/REGISTRATION_CONTRACT.md`, rendered Home/Tools/Settings/help text | Visibility, plain-language comprehension, and no implication of professional monitoring |
| Offline and external help behavior | Installed PWA in airplane/offline conditions | What remains available offline; external phone/link behavior; no promise that an external service is reachable offline |

## Scenario review

The reviewer must exercise at least these combinations in both languages:

1. No acute concern selected yet; progression remains blocked without silently
   treating this as “none.”
2. “None of these” selected; selecting another concern removes “none,” and selecting
   “none” clears other concerns.
3. Immediate danger to self or another person, with 112 visible.
4. Suicide-related concern without stated immediate danger, with 113 and the
   appropriate escalation wording visible.
5. Possible severe withdrawal involving a currently selectable alcohol or
   benzodiazepine target, without generalizing substance guidance to a behavioural
   target. Adding another substance requires a separate product and content review.
6. Possible opioid overdose or tolerance-loss concern, including mixed alcohol or
   benzodiazepine use and the limitation that naloxone does not replace emergency
   medical help.
7. Anxiety with a “reaction” answer plus a new/severe/different symptom caveat; one
   message must not suppress the other.
8. A completed and an abandoned delay timer; only actual completion may be stored as
   completed duration.
9. Unanswered, “unknown,” “none,” and an explicit zero where applicable; History and
   Insights must preserve their different meanings.
10. Records created before the current schema migration, including multiple targets
    and concerns; no first-selected value may silently become “primary.”

## Source register

Last source check: 2026-08-02. These sources support cautious boundaries and routing;
their presence does not constitute review sign-off.

| Topic | Source | Automated access record | Qualified reviewer verification |
| --- | --- | --- | --- |
| Self-help scope and escalation for serious withdrawal/discomfort | WHO, *Self-help strategies for cutting down or stopping substance use*: https://www.who.int/publications/i/item/9789241599405 | Link/content checked 2026-08-02 | PENDING |
| Respectful, needs-led psychosocial support and competent delivery | NICE CG51: https://www.nice.org.uk/guidance/cg51/chapter/Recommendations | Automated retrieval blocked (403) on 2026-08-02; content not freshly verified | PENDING |
| Immediate danger and suicide-prevention routes in the Netherlands | 113 Suicide Prevention, English information: https://www.113.nl/english | Link/content checked 2026-08-02 | PENDING |
| Withdrawal symptoms and substances that may require medical help | DRUGSinfo: https://www.drugsinfo.nl/vraag/wat-zijn-ontwenningsverschijnselen/ | Link/content checked 2026-08-02 | PENDING |
| Tolerance loss, opioid overdose, and risky combinations | DRUGSinfo: https://www.drugsinfo.nl/heroine/heroine-risicos-verminderen | Link/content checked 2026-08-02 | PENDING |
| Naloxone is temporary emergency treatment and does not replace medical help | DRUGSinfo: https://www.drugsinfo.nl/overige-middelen/wat-is-narcan-naloxone/ | Link/content checked 2026-08-02 | PENDING |

The reviewer must note source-access problems, material changes, and any additional
guideline used. Product copy should not imply that a public information page is a
personal medical recommendation.

## Issue and decision log

Add one row for every requested change, limitation, disagreement, or explicitly
accepted risk. Do not delete resolved rows; mark their resolution.

| ID | Language / area | Finding | Severity | Required change | Resolution evidence | Reviewer status |
| --- | --- | --- | --- | --- | --- | --- |
| QCR-001 | PENDING | PENDING | PENDING | PENDING | PENDING | PENDING |

## Sign-off

The overall status may change from **PENDING QUALIFIED HUMAN REVIEW** only when:

- every reviewer field is complete;
- the rendered scenarios above were reviewed in both languages;
- all blocking issues are resolved and rechecked;
- any accepted limitations are visible in the decision log; and
- the reviewer records an explicit decision and signature/date below.

Clinical reviewer signature: PENDING
Dutch-language reviewer signature (if separate): PENDING
Final decision date: PENDING

Until then, no release note, screen, store description, or documentation may call
Anchor clinically approved, clinically validated, medically approved, or a validated
clinical assessment.

After sign-off, those claims remain prohibited unless separate evidence and any
required regulatory review specifically support them. Packet completion alone never
establishes clinical efficacy, clinical validation, or medical-device approval.

## 8 September 2026 extension — qualified review still pending

This implementation responds to C01/C02/C04/C05/C07/C08 in the clinical audit. It is an AI-assisted source and software update, not human clinical sign-off. All reviewer credentials, decisions and signatures above remain PENDING.

### Additional inventory and provenance

| Area | Active files | Claim boundary and review requirement |
| --- | --- | --- |
| Target catalogue and behavior context | `src/lib/recoveryTargets.ts`, target selectors, `src/components/TargetSafetyAdvice.tsx` | Existing values retained; GHB/GBL/other/unknown added. Behavioral choices are not diagnoses. Review person-defined scope in both languages. |
| Optional use details | `src/lib/useDetails.ts`, `src/components/UseDetailsEditor.tsx`, tracker builders | Original recording design, not a validated questionnaire. Approximate amount/unit, unknown/prefer-not and prescribed medication remain separate. No dose assessment. `useDetailsJson` preserves the existing primitive-answer contract; its contents are strictly validated. |
| Care directory and routing | `src/lib/careDirectory.ts`, `CareContactCard.tsx`, `CareContactSettings.tsx`, CrisisNow/Tools | Each entry carries its primary URL/date. Role/hours/eligibility are shown, not promised. Referrer-only routes have no public call button. Changed saved numbers require explicit reselection. |
| Personal support agreements | `PersonalContactsSettings.tsx`, `PersonalContactCard.tsx`, `src/lib/contactDrafts.ts` | Person-entered role, availability, agreed support and fallback are not a promise of monitoring or consent to message. Report-sharing preferences are distinct from full-backup preservation. Unsaved contact drafts remain available after opening help. |
| Home inspiration | `src/lib/recoveryQuotes.ts` | Original supportive text, no fixed craving duration, universal effect or sufficient-treatment claim. Include all rotating messages in bilingual review. |
| Play the tape / anxiety feedback | `src/lib/translations.ts`, rendered tool and AnxietyTracker | Hypothetical outcomes and personal goals; no clean/dirty wording or invented craving. Contextual review pending. |

### Additional primary source checks

- Thuisarts GHB stop/reduction page, revised 17 August 2026, reopened 8 September: https://www.thuisarts.nl/drugs/ik-wil-stoppen-met-ghb-of-minder-gebruiken — supports seeking medical help because withdrawal can be dangerous. No tapering schedule is incorporated.
- Drugsinfo cold-turkey stopping, reopened 8 September: https://www.drugsinfo.nl/verslaving/cold-turkey-stoppen-met-drugs/ — dangerous withdrawal may involve GHB/GBL, alcohol or benzodiazepines.
- Each care-directory source was checked in the 8 September directory audit. Tactus and GGNet were reopened for implementation. The Ypsilon homepage direct fetch failed; its own advice/contact text was available through primary search retrieval. Where opening times were unconfirmed the UI refers to the official page rather than inventing hours.

### Added review scenarios

1. GHB/GBL selected before use outcome: medical stop/reduction advice is available, with no autonomous detox instructions.
2. Other/unknown substance and mixed entries: no false safe category or invented amount.
3. Food/gaming/sexual behavior: personal boundary framing, no blanket abstinence or diagnosis.
4. Tactus/VNN at night, Brijder prevention and GGNet for a client: GP/HAP fallback remains visible; restricted/advisory contacts do not become unrestricted crisis care.
5. Old Indigo number is retained as unconfirmed; no silently substituted call destination.
6. Multi-substance detail and prescribed medication survive draft/save/export/import. No-use changes remove incompatible details; unknown amount remains unknown.
7. Offline advice is readable, but telephone services and external websites need the appropriate connection. Automated tests do not contact real services.
8. Review both languages of Home quotes, anxiety distraction feedback, tools and new care/plan views. Passing tests and preparing this packet do not complete qualified review.
9. Edit a support person's availability, agreed support and report preference, open help and return; confirm the unfinished draft is preserved. Review report selection and verify that “keep private” starts excluded while allowing the user to choose sharing explicitly for that report. Full backups retain all saved contact data.
