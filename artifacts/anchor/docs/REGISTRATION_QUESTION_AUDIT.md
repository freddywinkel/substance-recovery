# Registration question audit

Date: 2026-08-02
Scope: the questions, answers, progression rules, conditional branches, and saved
meanings in the five Anchor registration flows. Navigation, general app UI, and
Insights calculations were outside this audit except where they consume a visible
registration answer.

## Authoritative status

Earlier passes covered registration safety, persistence, ordering, and parts of
the flow logic. They did **not** constitute a fresh, question-by-question audit of
all five current flows. This is that audit.

The source taxonomy lists contain **429 entries**. Adding the five Relapse acute-risk
controls and one bespoke no-clear trigger produces **435 distinct named selectable
entries**. Repeating the nine Relapse help options in two additional phase questions
adds 18 visible appearances, for **453 predefined labelled option instances as
presented across visible questions and conditional branches**. Free-text, numeric,
date/time, boolean, and follow-up controls are disclosed separately rather than
added to that option count.

| Flow | Enumerated options | Required answers | Genuinely optional answers | Branch or save checks |
| --- | ---: | --- | --- | --- |
| Urge or craving | 91 | onset; situation and buildup; next action plus attempted/not-yet; reported use outcome | intensity, confidence, location, inner experience, target, later intensity/outcome | no-clear situation is exclusive; hidden Other text is cleared; behaviour-only targets do not show substance medical copy |
| Planned or active urge (Trek) | 92 | approach form; immediacy; trigger/no-clear answer; need/not-sure answer; next action plus attempted/not-yet; reported use outcome | intensity, confidence, location, inner experience, targets, after-action confidence | form and immediacy are separate axes; legacy drafts and saved records migrate without dropping motive/context meaning; no primary need or target is invented; after-confidence is stored only after an attempted action |
| Anxiety | 53 | anxiety type; body location/broad/unknown answer; urgency; reaction/not-yet answer | intensity, prediction, context, reassurance patterns, linked states, triggers, later outcome | urgency starts unanswered; broad/unknown body answers exclude specific locations; no primary trigger or linked state is invented |
| Boredom or restlessness | 73 | one or two descriptions; need/not-sure; classification; situation; action/not-yet unless converting | intensity, urge, rescue ideas, note, later outcome | conversion saves the Boredom entry before routing; incompatible suggestions are removed; opening the delay tool is not completion; only a fully elapsed timer is durably recorded |
| Relapse or return to behaviour | 144 | one or more current-safety choices, or exclusive none; exact occurrence time; support contact/no-one/own text; next step/own text | self-chosen label, duration, target, amount, trigger, lead-up, warning signs, thought, phase-specific help, note, post-save need/actions/emotion | safety and time start unanswered; simultaneous concern routes remain visible; no-clear trigger is explicit; early/middle/last help remain independent; custom and canned choices cannot conflict |

## Question-by-question requirement and evidence map

`Required` below means progression or saving is blocked until the person gives a
visible answer. `Optional` means the question can actually be skipped and its
canonical answer is `null` when unanswered. Conditional questions are required
only while the controlling answer makes them visible. Every row was checked
against its English and Dutch source copy, progression gate, saved versioned
answer, draft restoration, and applicable focused test. The rendered-browser
matrix in the verification section is separate representative UI evidence; it
does not claim that every branch was rendered in both languages.

### Urge or craving

| Step | Question | Rule | Saved meaning and branch evidence |
| --- | --- | --- | --- |
| What happened | Kind of onset | Required single choice | Stable onset ID; choosing Other requires and retains its text, while changing away clears it. |
| What happened | Intensity now | Optional 0-10 | `null` until the slider is intentionally changed. |
| What happened | Confidence not to act | Optional 0-10 | `null` until intentionally changed. |
| What happened | Current location | Optional single choice | `null` when skipped. |
| Context and body | Situation or context | Required multi-choice | Includes an exclusive no-clear answer; Other requires text. |
| Context and body | Physical sensations | Optional, maximum three | Stable ID list or `null`; the cap is enforced in both UI and restored-draft validation. |
| Context and body | Buildup duration | Required single choice | Stable duration ID. |
| Inner experience | Emotions and own words | Optional, maximum three chips | Chip IDs and free text are independently retained; both are `null` when skipped. |
| Inner experience | Thoughts and own words | Optional, maximum two chips | Chip IDs and free text are independently retained; both are `null` when skipped. |
| Target | Substance or behaviour involved | Optional multi-choice | Stable target IDs or `null`; behaviour-only targets suppress substance-specific medical copy. |
| Next action | Chosen coping action | Required single choice | Stable action ID records intent only. |
| Next action | Tried it or not yet | Required boolean choice | Attempted state is separate from action intent; tool navigation first persists the return target. |
| Outcome | Used or acted on the behaviour | Required single choice | Stable reported outcome; all used/acted routes reach the same safety and follow-up handling. |
| Completion | Change in urge and later intensity | Optional follow-up | Reported change and after-score remain `null` until answered and are synchronized into the saved answer envelope. |

Evidence: `craving-trek-question-flow.test.ts`,
`active-registration-catalog-validation.test.ts`, `registration-safety.test.ts`,
`taxonomy-integrity.test.ts`, and the rendered checks listed below.

### Planned or active urge (Trek)

| Step | Question | Rule | Saved meaning and branch evidence |
| --- | --- | --- | --- |
| How it is taking shape | Form of approach | Required, at least one | Stable ID list on one observable-form axis; restored drafts cannot exceed the visible cap. |
| How it is taking shape | Intensity now | Optional 0-10 | `null` until intentionally changed. |
| How it is taking shape | Confidence not to act | Optional 0-10 | `null` until intentionally changed. |
| Immediacy and context | Closeness to action | Required single choice | Stable immediacy ID, semantically separate from form, motive, and trigger. |
| Planning and context | Location | Optional single choice | Other text is conditionally required and cleared when hidden; otherwise `null` when skipped. |
| Planning and context | Trigger | Required multi-choice | No-clear is exclusive; Other requires text; restored drafts enforce the same rule. |
| Inner experience | Emotions and own words | Optional, maximum three chips | Stable IDs/free text or `null`. |
| Inner experience | Physical sensations | Optional, maximum three | Stable IDs or `null`. |
| Inner experience | Thoughts and own words | Optional, maximum two chips | Stable IDs/free text or `null`. |
| Need | What is needed | Required multi-choice | Includes exclusive Not sure; Other requires text; the unordered array is authoritative and no first selection is promoted. |
| Target | Substance or behaviour involved | Optional multi-choice | Stable target IDs or `null`; the unordered array is authoritative and no first selection is promoted. |
| Next action | Chosen action | Required single choice | Stable action ID records intent. |
| Next action | Tried it or not yet | Required boolean choice | Attempt state is separate; after-confidence is omitted unless an action was attempted. |
| Outcome | Used or acted on the behaviour | Required single choice | Stable reported outcome with the same safety/follow-up route as Craving. |

Evidence: `craving-trek-question-flow.test.ts`,
`active-registration-catalog-validation.test.ts`, `registration-safety.test.ts`,
`taxonomy-integrity.test.ts`, and the rendered checks listed below.

### Anxiety

| Step | Question | Rule | Saved meaning and branch evidence |
| --- | --- | --- | --- |
| What kind | Anxiety type | Required, one or two | Stable ID list; the restored-draft cap matches the UI. |
| What kind | Intensity now | Optional 0-10 | `null` until intentionally changed. |
| In the body | Body location | Required multi-choice | Broad/unknown is exclusive with specific locations. |
| In the body | Feared body outcome | Optional text | Trimmed text or `null`. |
| Urgency | Need immediate help | Required yes/no | Starts `null`; either deliberate answer is retained without defaulting to false. |
| More detail | Context | Optional single choice | Stable ID or `null`. |
| More detail | Triggers | Optional multi-choice | Stable IDs or `null`; no first selection becomes a fake primary trigger. |
| More detail | Reassurance/avoidance patterns | Optional multi-choice | Stable IDs or `null`. |
| More detail | Linked states | Optional multi-choice | No-specific-link is exclusive; no first selection becomes a fake primary state. |
| Reaction | What happened next | Required single choice | Includes Not yet / just logging, so observation is not misreported as an attempted action. |
| Reaction | Note | Optional text | Trimmed text or `null`. |
| Completion | Later anxiety outcome | Optional follow-up | `null` until answered and synchronized into the saved answer envelope. |

Every completion branch renders the medical red-flag caveat independently of
the reaction-specific reflection. Evidence: `anxiety-boredom-semantics.test.ts`,
`active-registration-catalog-validation.test.ts`, `registration-safety.test.ts`,
`taxonomy-integrity.test.ts`, and the rendered checks listed below.

### Boredom or restlessness

| Step | Question | Rule | Saved meaning and branch evidence |
| --- | --- | --- | --- |
| What it feels like | Description | Required, one or two | Stable ID list; restored drafts enforce the visible cap. |
| What it feels like | Intensity now | Optional 0-10 | `null` until intentionally changed. |
| What is needed | Stimulation need | Required multi-choice | Includes exclusive Not sure; the full list is authoritative and no first selection becomes a primary need. |
| What is needed | Better-fit classification | Required single choice | Stable ID controls whether this tracker completes or first saves then routes to Anxiety/Craving. |
| Situation | Current situation | Required single choice | Other requires text and clears it when hidden. |
| Situation | Current urge | Optional single choice | Stable ID/own text or `null`; a substance urge offers, but does not silently force, a Craving follow-up. |
| Action | Rescue ideas | Optional multi-choice | Stable IDs or `null`; incompatible groups are not shown together. |
| Action | What happened | Required when staying in this tracker | Includes Not yet / just logging; omitted on a conversion branch. |
| Action | Note | Optional text | Trimmed text or `null`; omitted on a conversion branch. |
| Completion | Later restlessness outcome | Optional follow-up | `null` until answered and synchronized into the saved answer envelope. |

Opening the delay tool does not claim that ten minutes were completed.
Evidence: `anxiety-boredom-semantics.test.ts`,
`active-registration-catalog-validation.test.ts`, `registration-safety.test.ts`,
`taxonomy-integrity.test.ts`, and the rendered checks listed below.

### Relapse or return to behaviour

| Step | Question | Rule | Saved meaning and branch evidence |
| --- | --- | --- | --- |
| Safety and description | Immediate concern | Required multi-choice | Starts unanswered; `none` is exclusive, while simultaneous concerns remain complete and can activate more than one relevant support route. All five choices use stable IDs and translated labels. |
| Safety and description | Self-chosen label | Optional single choice | All five labels are available; canonical answer remains `null` when skipped. |
| When | Exact occurrence time | Required date/time | The event timestamp, not Save time, becomes `occurredAt`; invalid/future values cannot save. |
| When | Relative time | Derived/helper choice | Quick choices populate exact time; manual time derives the relative label. |
| When | Duration | Optional single choice | Stable ID or `null`. |
| When | Substance or behaviour involved | Optional multi-choice | Stable IDs or `null`; no fake primary target is invented. |
| When | Amount or frequency | Optional conditional choice | Stable ID or `null`; only relevant after a target is selected. |
| Trigger | First cue or turning point | Optional canned choice or own text | Includes Not sure; canned and custom answers clear one another bidirectionally. |
| Before | Lead-up factors | Optional multi-choice | Stable IDs or `null`. |
| Before | Warning signs | Optional multi-choice | Stable IDs or `null`. |
| Before | Thought immediately before | Optional chips and own text | Stable IDs/text or `null`; multiple selected thoughts are retained. |
| Before | Help that might have helped earlier | Optional multi-choice | Stored independently from the middle and last phases. |
| Before | Help during the buildup | Optional multi-choice | Stored independently from earlier and last. |
| Before | Help immediately beforehand | Optional multi-choice | Stored independently from earlier and middle. |
| Next step | Person to involve | Required canned choice or own text | Canned and custom answers are exclusive; No one right now is a truthful answer. |
| Next step | Manageable first step | Required canned choice or own text | Canned and custom answers are exclusive. |
| Next step | Note | Optional text | Trimmed text or `null`. |
| Completion | Need, repair actions, and emotion after | Optional follow-up | Need and actions use stable IDs. Emotion after is an optional 0-10 answer: `0` is a real answer and `null` is unanswered. All three synchronize with the saved envelope. |

Evidence: `relapse-flow-semantics.test.ts`,
`active-registration-catalog-validation.test.ts`, `registration-safety.test.ts`,
`taxonomy-integrity.test.ts`, and the rendered checks listed below.

## Findings repaired in this change set

1. **Preselected answers were being mistaken for user answers.** Relapse no longer
   starts with `no-label`, `just-now`, or an occurrence time. Anxiety urgency was
   already tri-state and remains so.
2. **Some required questions lacked a neutral truthful answer.** Craving situation,
   Trek trigger and need, Anxiety body location, Boredom need, and the Anxiety and
   Boredom reaction questions now provide explicit unknown, no-clear, or not-yet
   answers where appropriate.
3. **Mutually exclusive answers could coexist.** No-clear, broad-body, and unknown
   choices now clear incompatible specific choices in both the UI and resumable
   draft validation.
4. **Conditional answers could survive after their question disappeared.** Hidden
   Other text, outcome details, confidence-after values, and conversion-only action
   data are now cleared or omitted when their controlling answer changes.
5. **Multi-select answers could be silently rewritten as a primary answer.** Trek
   need, Anxiety trigger/linked state, and Boredom need now keep the complete array
   authoritative and leave obsolete scalar aliases empty.
6. **Relapse retrospective answers lost meaning.** One help selection was previously
   copied into the early, middle, and last phases. Those three answers are now
   independent and also have a de-duplicated general view for compatible consumers.
7. **Time and timer meaning was inaccurate.** Relapse requires the actual event
   time and derives its relative label from that value. Opening the Boredom delay
   tool no longer records ten minutes as completed.
8. **Saved data omitted visible information.** Versioned answer envelopes now retain
   visible free text, optional answers as `null`, phase-specific help, action-attempt
   state, and post-save outcomes. History prefers the canonical optional Relapse
   label over the legacy compatibility value.
9. **Some copy implied diagnosis, causation, blame, or substance-only meaning.**
   An AI-assisted software/content wording pass aligned English and Dutch prompts
   with operational, non-diagnostic labels; outcome copy describes reported change
   without claiming a selected action caused it; target wording includes behaviours;
   medical copy is target-aware. This is not clinical validation; the qualified
   bilingual review remains pending.
10. **Blocked questions did not say they were required.** Every answer that gates
    Next or Save now has a visible required marker, including conditionally visible
    Other fields. Questions that can actually be skipped are marked optional.
11. **Opening a coping tool could outrun the draft write.** Craving and Trek now wait
    for the return target to persist and do not navigate when that write fails.
12. **Anxiety reaction copy could replace its medical caveat.** The red-flag and 112
    caveat now renders independently for every reaction branch.
13. **Relapse trigger alternatives could contradict each other.** Choosing canned
    text clears custom text and entering custom text clears the canned choice.
14. **An optional marker was duplicated in the Add note control.** The shared label
    now carries only the action text; the field-status marker is rendered once.
15. **Trek's first two questions mixed different concepts.** The first question now
    stores only the form that movement toward acting is taking; the second stores
    only immediacy. Retired v1 and v2 draft values migrate into form, immediacy,
    need, and trigger fields without discarding their meaning.
16. **Trek did not need a separately selected primary need or target.** Need and
    target arrays are now the explicit authoritative answers. Their order has no
    primary meaning, and compatibility scalars remain empty on new Trek records.
17. **The first repair did not migrate completed Trek records.** Retired Trek
    values are now split into approach form, immediacy, need, and trigger meanings
    for stored records as well as active drafts. The existing IndexedDB v8 upgrade,
    import validation, History, and analytics use the same migration map.
18. **Relapse safety could represent only one immediate concern.** The question is
    now a required multi-select. `none` is exclusive; simultaneous concerns remain
    complete; every applicable support route can render; the singular field is
    retained only as a derived compatibility alias.
19. **Legacy and current safety answers could be conflated.** Pre-v2 preselected
    `none` remains unproven, deployed-v2 singular `none` remains deliberate, and v3
    requires the canonical array. Canonical null/array presence wins over aliases,
    and conflicting import shapes are rejected.
20. **Version-2 defaults and split follow-up writes could distort History.** The
    unproven preselected Relapse label/time defaults are cleared only in canonical
    v2 answers, while meaningful v2 post-save need, repair, and emotion values,
    including numeric zero, are reconciled into their blank canonical slots.
21. **Attention and Home summaries inferred meaning the person had not answered.**
    The synthetic Home risk score was removed. Attention now uses only explicit
    Anxiety urgency and Relapse concern answers; intensity, outcomes, selected
    actions, and legacy `highRiskFlag` are not severity proxies.
22. **Draft records leaked into completed-registration views.** History, Home,
    sobriety calculations, and Insights now exclude draft Craving and Relapse
    records before counting, grouping, or deriving timestamps.
23. **Delay completion was not durably represented.** Launching or stopping early
    records no completed duration. A fully elapsed delay is persisted idempotently
    to both the Boredom record and its canonical answer and survives reload/retry.
24. **Current data semantics needed an explicit version boundary.** New records use
    `dataVersion: 3` and `contentVersion: registration-v3`; active drafts use version
    3. Compatibility backfills are restricted to the release shapes that actually
    omitted those fields, while explicit v3 nulls remain authoritative.
25. **Current imports did not originally enforce their complete answer contracts.**
    Each flow now validates its exact v3 envelope, conditional invariants, answer
    types, selection caps, and Relapse safety/time requirements. Hidden scalar
    aliases cannot create a v3 answer. Well-formed unknown stable IDs remain
    preserved only for forward compatibility and are not claimed as current
    catalog membership.
26. **History could translate a person's own words as though they were option IDs.**
    History now tags each item as a canonical option or literal text. Only option
    IDs are translated; ID-looking own text remains verbatim in English and Dutch.
27. **Writer and validator rules could disagree.** Anxiety now visibly communicates
    and enforces its one-or-two cap. Boredom's optional own-text urge is accepted as
    optional by import validation, while its conditional situation-Other field is
    visibly required because it gates progression.
28. **Trek legacy motive/context migration manufactured a new form answer.**
    Boredom and emotional-escape values preserve only their need meaning; social
    pressure preserves only its trigger meaning. None becomes an inferred approach
    or explicit `approach-not-sure`. Completed history leaves the new axis
    unanswered; a resumed draft returns to the required form step.
29. **Historical intervention notes could be mistaken for reviewed guidance.** The
    unsupported duration, mechanism, origin, effect, exercise, and unsafe cold-water
    notes were retired. Current safety copy is source-checked/AI-assisted and remains
    pending scoped qualified bilingual human review.
30. **Home's completion wording used event time.** “Last completed registration” now
    uses `completedAt`, with the legacy record timestamp only as fallback. A person
    logging an older event today is no longer told that completion happened on the
    event date.

## Deliberate next-run candidate status

1. **Trek taxonomy split: implemented.** Observable approach form is separate from
   immediacy, motive, and trigger. Legacy active drafts and completed records are
   migrated without manufacturing a new answer.
2. **Relapse multi-concern safety: implemented in product/data code.** Schema,
   routing, import/read migration, restored drafts, History, and analytics preserve
   simultaneous concerns; `none` is exclusive. Qualified human safety review
   remains pending.
3. **No-primary decision: implemented.** Unordered multi-select arrays are
   authoritative. Selection order does not invent a primary need, target, trigger,
   linked state, or thought; compatibility scalars are blank or ignored.
4. **`highRiskFlag` severity shortcut: removed from interpretation.** The field
   remains false on new writes only for compatibility. No Home or Insights rule
   treats intensity or that field as a safety/severity answer. Attention is based
   only on answered Anxiety urgency or Relapse safety concerns.
5. **Canonical History/Home/Insights consumers: implemented.** Version 3 answers
   are authoritative, with narrowly version-scoped legacy fallbacks. Craving and
   Relapse drafts are excluded from completed-registration views.
6. **Delay completion capture: implemented.** Launch and early stop are not
   completion evidence. Only elapsed wall-clock completion is persisted,
   idempotently, to the log and canonical answer and survives reload/retry.
7. **Qualified bilingual human clinical/content/safety review: pending external
   action.**
   `QUALIFIED_CONTENT_REVIEW_PACKET.md` defines the inventory, scenarios, issue log,
   credentials, and sign-off gate. Preparing that packet is not clinical approval.

## Content source record

Reviewer status: AI-assisted product, logic, and cautious self-help copy review;
**not a qualified clinical review**. Sources were used to set boundaries and avoid
stigmatizing or unsupported claims, not to validate the app as treatment. The
controlled hand-off and unresolved sign-off fields are in
`QUALIFIED_CONTENT_REVIEW_PACKET.md`:

- WHO, *Self-help strategies for cutting down or stopping substance use*:
  https://www.who.int/publications/i/item/9789241599405
- NICE CG51, *Drug misuse in over 16s: psychosocial interventions*:
  https://www.nice.org.uk/guidance/cg51/chapter/Recommendations
- NICE CG115, *Alcohol-use disorders: diagnosis, assessment and management*:
  https://www.nice.org.uk/guidance/cg115/chapter/Recommendations
- NICE NG64, *Drug misuse prevention*:
  https://www.nice.org.uk/guidance/ng64/chapter/Recommendations
- NIDA, *Words Matter*:
  https://nida.nih.gov/sites/default/files/words_matter_handout.pdf
- SAMHSA, *Stigma and Language*:
  https://www.samhsa.gov/substance-use/treatment/stigma-language
- DRUGSinfo, withdrawal information:
  https://www.drugsinfo.nl/vraag/wat-zijn-ontwenningsverschijnselen
- 113 Suicide Prevention, immediate-danger and suicide-support routes:
  https://www.113.nl/english
- DRUGSinfo, heroin tolerance loss, overdose, and risky combinations:
  https://www.drugsinfo.nl/heroine/heroine-risicos-verminderen/
- DRUGSinfo, naloxone as temporary emergency treatment rather than a replacement
  for medical help:
  https://www.drugsinfo.nl/overige-middelen/wat-is-narcan-naloxone/

Automated access on 2026-08-02 confirmed the linked WHO, 113, and DRUGSinfo pages
used for the current safety boundary. NICE returned HTTP 403 to the automated
retrieval, so its recommendation text was not treated as freshly verified. NIDA,
SAMHSA, NICE, and every source still require the qualified review recorded in the
review packet; link presence is not sign-off.

## Verification evidence

- Source/catalog review: all five flows; 429 source-list entries, 435 distinct named
  selectable entries, and 453 visible option instances; plus free-text fields,
  nullable scales, booleans, exact date/time, follow-ups, progression gates,
  conditional branches, resumable drafts, and versioned saved meanings.
- Automated suite: 22 test files and 631 tests passed. Coverage includes exact v3
  envelopes, null/zero semantics, selection caps, UI/writer/import agreement,
  literal-versus-option History rendering, failed-write navigation, all Anxiety
  reaction caveat branches, Relapse trigger/safety exclusivity, completed-only
  consumers, completion-time semantics, and idempotent delay completion.
- Real fake-IndexedDB integration covers direct v6-to-v8 and v7-to-v8 upgrades,
  deployed-v2 fixtures, metadata preservation, completed Trek migration, and
  Relapse safety/time/follow-up reconciliation.
- TypeScript: passed with no errors.
- Diff integrity: `git diff --check` passed. Git emitted only the repository's
  existing LF-to-CRLF working-copy warnings.
- Production build: passed after transforming 2,457 modules. The GitHub Pages SPA
  fallback was copied to `404.html`; the generated PWA has 17 precache entries
  (1404.96 KiB), and the artifact verifier passed for `/substance-recovery/`.
- Rendered frozen production artifact on a fresh origin at 390 x 844: all five Dutch
  registration entry screens were opened; representative English Anxiety and
  Relapse screens were also rendered. Observed interactions covered untouched
  required defaults, disabled progression, Trek cap/neutral exclusivity, Anxiety's
  two-choice cap and replacement, Boredom's required situation-Other versus
  optional urge text without duplicate markers, and simultaneous Relapse concerns
  followed by exclusive no-concern clearing.
- Shell/help/settings render checks found no horizontal overflow (390 px document
  width), an 80 px footer ending exactly at the 844 px viewport bottom, neutral Home
  activity instead of a risk score, visible 112/113 distinction, discoverable urgent
  help, no login controls/password field, and explicit local-only storage copy. The
  final-origin browser console contained no warnings or errors.
- Limitations: the native `datetime-local` picker, a fully elapsed ten-minute timer,
  installed-iPhone safe areas, and airplane-mode behavior were not exercised on a
  physical device in this run; their code/data semantics are covered by automated
  tests where possible. Qualified bilingual human clinical/content/safety review is
  still pending and cannot be replaced by these checks.
- Non-blocking build notices: a JavaScript chunk above 500 kB and six-month-old
  Browserslist data.
- Release status: local change set only. Nothing was committed, pushed, deployed,
  or tested against the public GitHub Pages URL in this run.
