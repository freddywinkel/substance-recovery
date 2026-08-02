# Anchor qualified content review packet

Status: **PENDING QUALIFIED HUMAN REVIEW**

Packet version: 1.0
Prepared: 2026-08-02
Product content version: `registration-v3`
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
