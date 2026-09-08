import { useLocalDraft } from "@/hooks/useLocalDraft";
import { isCareContactDraft, type CareContactDraft } from "@/lib/contactDrafts";
import { ContactDraftStatus } from "./ContactDraftStatus";
import { useState } from "react";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { CARE_DIRECTORY, careRoleLabel, directoryContact, type CareRole } from "@/lib/careDirectory";
import { CareContactCard } from "./CareContactCard";
/** Saved legacy contact is retained until the person explicitly changes it. */
export function CareContactSettings() {
  const { crisisService, setCrisisService, loading } = useStore();
  const { language, t } = useT();
  const nl = language === "nl";
  const draft = useLocalDraft<CareContactDraft>("care-contact", {
    selected: crisisService?.isCustom ? "custom" : crisisService?.id ?? "",
    name: crisisService?.isCustom ? crisisService.name : "", number: crisisService?.isCustom ? crisisService.number : "",
    role: crisisService?.role ?? "unverified", availability: crisisService?.availability ?? "", eligibility: crisisService?.eligibility ?? "",
  }, { ready: !loading, validate: isCareContactDraft });
  const { selected, name, number, role, availability, eligibility } = draft.value;
  const setField = <K extends keyof CareContactDraft>(key: K, value: CareContactDraft[K]) => draft.setValue(previous => ({ ...previous, [key]: value }));
  const setSelected = (value: string) => setField("selected", value);
  const setName = (value: string) => setField("name", value);
  const setNumber = (value: string) => setField("number", value);
  const setRole = (value: CareRole) => setField("role", value);
  const setAvailability = (value: string) => setField("availability", value);
  const setEligibility = (value: string) => setField("eligibility", value);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedEntry = CARE_DIRECTORY.find(item => item.id === selected);
  const selectionMatchesSaved = selectedEntry && crisisService && !crisisService.isCustom
    && crisisService.id === selectedEntry.id
    && crisisService.number.replace(/\D/g, "") === selectedEntry.number.replace(/\D/g, "");
  const save = async () => {
    if (saving || !draft.hydrated || draft.error) return;
    if (selected === "custom" && (!name.trim() || number.replace(/\D/g, "").length < 3)) { setError(nl ? "Vul een naam en telefoonnummer in." : "Enter a name and phone number."); return; }
    setSaving(true); setError("");
    let contactSaved = false;
    try {
      const found = CARE_DIRECTORY.find(item => item.id === selected);
      if (selected && selected !== "custom" && !found) throw new Error("Choose a known contact or keep the saved contact unchanged.");
      if (selected === "custom") await setCrisisService({ id: "custom", name: name.trim(), number: number.trim(), isCustom: true, role, availability: availability.trim(), eligibility: eligibility.trim() });
      else await setCrisisService(found ? directoryContact(found, t(found.nameKey)) : null);
      contactSaved = true;
      await draft.clearDraft(draft.value);
    } catch { setError(contactSaved ? (nl ? "Contact opgeslagen; het concept kon niet worden gewist. Je kunt opnieuw opslaan." : "Contact saved; the draft could not be cleared. You can save again.") : (nl ? "Opslaan lukte niet. Je invoer staat er nog." : "Saving failed. Your input is still here.")); }
    finally { setSaving(false); }
  };
  const input = "w-full rounded-xl border border-input bg-background px-3 py-3 text-sm";
  if (!draft.hydrated) return <p className="text-sm">{nl ? "Contact laden…" : "Loading contact…"}</p>;
  return <section className="space-y-3">
    <h2 className="text-sm font-semibold">{nl ? "Zorg- en steuncontact" : "Care and support contact"}</h2>
    <p className="text-xs text-muted-foreground">{nl ? "Kies een contact dat bij jouw vraag past. Openingstijden en toegangsafspraken verschillen. Bewaar met je behandelaar ook de afspraken voor huisarts, huisartsenpost en spoed in Mijn plan." : "Choose a contact suited to your question. Opening hours and access differ. Record your GP, out-of-hours and urgent-care agreements with your care professional in My plan."}</p>
    <label className="block text-sm">{nl ? "Contact kiezen" : "Choose contact"}<select aria-label={nl ? "Contact kiezen" : "Choose contact"} disabled={saving} className={input} value={selected} onChange={e => setSelected(e.target.value)}>
      <option value="">{nl ? "Geen contact opgeslagen" : "No saved contact"}</option>
      {CARE_DIRECTORY.map(item => <option value={item.id} key={item.id}>{t(item.nameKey)} · {careRoleLabel(item.role, language)}</option>)}
      <option value="custom">{nl ? "Eigen contact toevoegen" : "Add my own contact"}</option>
    </select></label>
    {selected === "custom" && <fieldset disabled={saving} className="space-y-3 rounded-xl border border-border p-3"><legend>{nl ? "Eigen contact en afspraken" : "My contact and agreements"}</legend>
      <label className="block text-xs">{nl ? "Naam" : "Name"}<input className={input} maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block text-xs">{nl ? "Telefoon" : "Phone"}<input type="tel" className={input} maxLength={50} value={number} onChange={e => setNumber(e.target.value)} /></label>
      <label className="block text-xs">{nl ? "Functie volgens jouw afspraak" : "Role according to your agreement"}<select aria-label={nl ? "Functie volgens jouw afspraak" : "Role according to your agreement"} className={input} value={role} onChange={e => setRole(e.target.value as CareRole)}>{(["unverified", "treatment", "urgent-care", "advice", "listening", "relatives", "emergency", "suicide-support", "safeguarding", "non-acute-report"] as CareRole[]).map(r => <option key={r} value={r}>{careRoleLabel(r, language)}</option>)}</select></label>
      <label className="block text-xs">{nl ? "Bereikbaarheid / openingstijden" : "Availability / opening hours"}<input className={input} maxLength={500} value={availability} onChange={e => setAvailability(e.target.value)} /></label>
      <label className="block text-xs">{nl ? "Wanneer en waarvoor kan ik bellen?" : "When and why can I call?"}<textarea className={input} maxLength={500} value={eligibility} onChange={e => setEligibility(e.target.value)} /></label>
    </fieldset>}
    {selectedEntry && !selectionMatchesSaved && <><p className="text-xs text-muted-foreground">{nl ? "Gekozen contact — nog niet opgeslagen" : "Selected contact — not saved yet"}</p><CareContactCard service={directoryContact(selectedEntry, t(selectedEntry.nameKey))} language={language} /></>}
    <button type="button" disabled={saving || !!draft.error} onClick={save} className="touch-target rounded-xl bg-primary px-4 py-3 text-primary-foreground text-sm font-semibold disabled:opacity-50">{saving ? (nl ? "Opslaan…" : "Saving…") : (nl ? "Contact opslaan" : "Save contact")}</button>
    <ContactDraftStatus error={draft.error} conflict={draft.conflict} retry={draft.retry} keepMine={draft.keepMine} language={language} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {crisisService && <><p className="text-xs text-muted-foreground">{nl ? "Nu opgeslagen" : "Currently saved"}</p><CareContactCard service={crisisService} language={language} /></>}
  </section>;
}
