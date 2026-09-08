import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CareContactCard } from "../src/components/CareContactCard";
import { getSubstanceSafetyWarnings } from "../src/lib/registrationSafety";
import { CARE_DIRECTORY, resolveCareContact } from "../src/lib/careDirectory";
import { RECOVERY_TARGET_VALUES, getTargetScopeCopy, recoveryTargetLabel } from "../src/lib/recoveryTargets";
import { blankUseDetail, decodeUseDetails, encodeUseDetails, isValidUseDetails, useDetailsForRecord } from "../src/lib/useDetails";
import { parseActiveRegistration } from "../src/contexts/activeRegistrationValidation";
import { buildCravingAnswers, createBlankCravingDraft } from "../src/pages/CravingTracker";
import { buildTrekAnswers, createBlankTrekDraft } from "../src/pages/TrekTracker";
import { buildRelapseAnswers, createBlankRelapseDraft } from "../src/pages/RelapseLog";
import { getTranslation } from "../src/lib/translations";
import { validateImportedStoreRecord } from "../src/db/validation";
import { isCareContactDraft, isPersonalContactDraft } from "../src/lib/contactDrafts";

describe("target-aware recording and care routing", () => {
  it("retains legacy target values and adds explicit unknown/other and GHB/GBL", () => {
    expect(RECOVERY_TARGET_VALUES).toEqual(expect.arrayContaining(["Food / binge eating", "Opioids", "GHB", "GBL", "Other substance", "Unknown substance"]));
    expect(recoveryTargetLabel("Other substance", "nl")).toBe("Ander middel");
    expect(getTargetScopeCopy(["Food / binge eating"], "nl")).toContain("op zichzelf is geen terugval");
  });
  it.each(["en", "nl"] as const)("provides one GHB/GBL medical warning before any outcome in %s", language => {
    const warnings = getSubstanceSafetyWarnings([" GHB ", "GBL", "Alcohol"], language);
    expect(warnings.map(w => w.key)).toEqual(["alcohol", "ghb-gbl"]);
    expect(warnings[1].body).toContain("112");
    expect(getSubstanceSafetyWarnings(["Unknown substance"], language)[0].key).toBe("unknown");
    expect(getSubstanceSafetyWarnings(["Gaming"], language)).toEqual([]);
  });
  it("distinguishes advice/intake, public crisis routes and referrer-only routes", () => {
    expect(CARE_DIRECTORY.find(e => e.id === "tactus")).toMatchObject({ role: "treatment", publicDirect: true });
    expect(CARE_DIRECTORY.find(e => e.id === "brijder")?.role).toBe("advice");
    const ggnet = { id: "ggnet", name: "GGNet", number: "088 933 4400", isCustom: false };
    expect(resolveCareContact(ggnet, "nl")).toMatchObject({ publicDirect: false, role: "urgent-care" });
    const html = renderToStaticMarkup(createElement(CareContactCard, { service: ggnet, language: "nl" }));
    expect(html).not.toContain('href="tel:0889334400"');
    expect(html).toContain("huisarts");
  });
  it("preserves but flags the old Indigo number without silently dialing a replacement", () => {
    const old = { id: "indigo", name: "Indigo", number: "088 357 17 77", isCustom: false };
    expect(resolveCareContact(old, "en")).toMatchObject({ role: "unverified", publicDirect: false, changedNumber: true });
    const html = renderToStaticMarkup(createElement(CareContactCard, { service: old, language: "en" }));
    expect(html).toContain(old.number);
    expect(html).not.toContain('href="tel:');
    expect(html).toContain("official website");
  });
  it("does not silently certify a legacy custom contact", () => {
    const contact = { id: "custom", name: "My contact", number: "1234", isCustom: true };
    expect(resolveCareContact(contact, "en").role).toBe("unverified");
  });
  it("validates mixed self-report details and preserves unknown rather than inventing a dose", () => {
    const details = [{ ...blankUseDetail("GHB"), amountStatus: "unknown" as const }, { ...blankUseDetail("Alcohol"), amountStatus: "approximate" as const, amount: "2", unit: "glasses" }];
    expect(isValidUseDetails(details)).toBe(true);
    expect(decodeUseDetails(encodeUseDetails(details))).toEqual(details);
    expect(useDetailsForRecord({ useDetails: details, answers: { useDetailsJson: encodeUseDetails(details) } })).toEqual(details);
    expect(isValidUseDetails([{ ...details[0], amount: "10" }])).toBe(false);
    expect(isValidUseDetails([details[0], details[0]])).toBe(false);
    expect(isValidUseDetails([{ ...details[0], unexpected: true }])).toBe(false);
    expect(decodeUseDetails("invalid")).toBeNull();
  });
  it("retains details in every canonical tracker answer and clears contradictory not-used details", () => {
    const details = [{ ...blankUseDetail("Opioids"), prescribedUse: "as-prescribed" as const }];
    const craving = { ...createBlankCravingDraft(), substances: ["Opioids"], useOutcome: "used" as const, useDetails: details };
    const trek = { ...createBlankTrekDraft(), substances: ["Opioids"], useOutcome: "used" as const, useDetails: details };
    const relapse = { ...createBlankRelapseDraft(), substances: ["Opioids"], useDetails: details };
    for (const answers of [buildCravingAnswers(craving), buildTrekAnswers(trek), buildRelapseAnswers(relapse)]) expect(decodeUseDetails(answers.useDetailsJson)).toEqual(details);
    expect(buildCravingAnswers({ ...craving, useOutcome: "not_used" }).useDetailsJson).toBeNull();
    expect(buildTrekAnswers({ ...trek, useOutcome: "not_used" }).useDetailsJson).toBeNull();
  });
  it("accepts pre-extension drafts and preserves valid new details on resume", () => {
    const legacy = parseActiveRegistration({ version: 1, type: "craving", route: "/craving", step: "onset", draft: {}, updatedAt: 1700000000000 });
    if (!legacy.ok || !legacy.value) throw new Error("migration failed");
    const base = legacy.value;
    const draft = { ...createBlankCravingDraft(), substances: ["GBL"], useOutcome: "used", useDetails: [blankUseDetail("GBL")] };
    expect(parseActiveRegistration({ ...base, draft })).toMatchObject({ ok: true, value: { draft: { useDetails: draft.useDetails } } });
    const beforeExtension = { ...draft } as Record<string, unknown>; delete beforeExtension.useDetails;
    expect(parseActiveRegistration({ ...base, draft: beforeExtension })).toMatchObject({ ok: true, value: { draft: { useDetails: [] } } });
    expect(parseActiveRegistration({ ...base, draft: { ...draft, useDetails: [{ ...draft.useDetails[0], amountStatus: "bogus" }] } }).ok).toBe(false);
  });
  it("accepts a completed mixed-use record through the real import validator and rejects contradictory copies", () => {
    const timestamp = new Date("2026-09-08T09:00").getTime();
    const details = [{ ...blankUseDetail("GHB"), amountStatus: "unknown" as const }, { ...blankUseDetail("Opioids"), prescribedUse: "as-prescribed" as const }];
    const draft = { ...createBlankRelapseDraft(), occurrenceDateTime: "2026-09-08T09:00", when: "just-now", substances: ["GHB", "Opioids"], useDetails: details, firstTriggerType: "Memory / flashback", supportContact: "No one right now", nextStep: "Water, food, rest first", acuteRisks: ["none" as const], acuteRisk: "none" as const };
    const record = { ...draft, id: "detail-import", timestamp, occurredAt: timestamp, startedAt: timestamp, completedAt: timestamp, dataVersion: 3, contentVersion: "registration-v3", label: "no-label", status: "completed", answers: buildRelapseAnswers(draft, timestamp) };
    const result = validateImportedStoreRecord("relapseLogs", JSON.parse(JSON.stringify(record)));
    expect(result, result.ok ? undefined : result.error).toMatchObject({ ok: true, value: { useDetails: details } });
    expect(validateImportedStoreRecord("relapseLogs", { ...record, useDetails: [] }).ok).toBe(false);
    expect(validateImportedStoreRecord("relapseLogs", { ...record, substances: ["GHB"] }).ok).toBe(false);
  });
  it("validates unsaved contact values independently of completed-field requirements", () => {
    expect(isPersonalContactDraft(null)).toBe(true);
    expect(isPersonalContactDraft({ id: "draft-id", name: "", relationship: "", phone: "", supportNotes: "Still writing", sharingPreference: "ask-first" })).toBe(true);
    expect(isPersonalContactDraft({ id: "draft-id", name: "", relationship: "", phone: "", sharingPreference: "auto-send" })).toBe(false);
    expect(isCareContactDraft({ selected: "custom", name: "", number: "", availability: "", eligibility: "", role: "unverified" })).toBe(true);
  });
  it.each(["en", "nl"] as const)("uses neutral anxiety and hypothetical behavior-tool copy in %s", language => {
    expect(getTranslation(language, "anxiety.msg.distracted")).not.toMatch(/craving|urge/i);
    expect(getTranslation(language, "tape.choose.q1")).not.toMatch(/clean|schoon/);
    expect(getTranslation(language, "tape.intro_sub")).toContain(language === "nl" ? "eigen doel" : "own goal");
  });
});
