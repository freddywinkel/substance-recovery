import { useLocalDraft } from "@/hooks/useLocalDraft";
import { isPersonalContactDraft } from "@/lib/contactDrafts";
import { ContactDraftStatus } from "./ContactDraftStatus";
import { useState } from "react";
import type { EmergencyContact } from "@/db/schema";
import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";

const blank = (): EmergencyContact => ({ id: crypto.randomUUID(), name: "", relationship: "", phone: "", role: "", availability: "", supportNotes: "", fallback: "", sharingPreference: "unanswered" });
export function PersonalContactsSettings() {
  const { emergencyContacts, setEmergencyContacts, loading } = useStore();
  const { language } = useT(); const nl = language === "nl";
  const localDraft = useLocalDraft<EmergencyContact | null>("personal-contact", null, { ready: !loading, validate: isPersonalContactDraft });
  const draft = localDraft.value;
  const setDraft = localDraft.setValue;
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm";
  const update = (key: keyof EmergencyContact, value: string) => setDraft(previous => previous ? { ...previous, [key]: value } : null);
  const save = async () => {
    if (!draft || saving || !localDraft.hydrated || localDraft.error) return;
    const exists = emergencyContacts.some(item => item.id === draft.id);
    if (!draft.name.trim() || draft.phone.replace(/\D/g, "").length < 3) { setError(nl ? "Vul een naam en telefoonnummer in." : "Enter a name and phone number."); return; }
    if (!exists && emergencyContacts.length >= 50) { setError(nl ? "Er is ruimte voor 50 contacten." : "Up to 50 contacts can be saved."); return; }
    setError(""); setSaving(true);
    let contactSaved = false;
    try {
      const value = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim(), phone: draft.phone.trim() };
      await setEmergencyContacts(exists ? emergencyContacts.map(item => item.id === draft.id ? value : item) : [...emergencyContacts, value]);
      contactSaved = true;
      await localDraft.clearDraft(null);
    } catch { setError(contactSaved ? (nl ? "Contact opgeslagen; het concept kon niet worden gewist. Je kunt opnieuw opslaan." : "Contact saved; the draft could not be cleared. You can save again.") : (nl ? "Opslaan lukte niet. Je invoer blijft staan." : "Saving failed. Your input is still here.")); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    setSaving(true); setError("");
    try { await setEmergencyContacts(emergencyContacts.filter(item => item.id !== id)); setRemoving(null); }
    catch { setError(nl ? "Verwijderen lukte niet. Het contact blijft staan." : "Removal failed. The contact is still here."); }
    finally { setSaving(false); }
  };
  if (!localDraft.hydrated) return <p className="text-sm">{nl ? "Steunpersonen laden…" : "Loading support people…"}</p>;
  return <section className="space-y-3">
    <h2 className="font-semibold text-sm">{nl ? "Mijn steunpersonen" : "My support people"}</h2>
    <p className="text-xs text-muted-foreground">{nl ? "Leg samen vast wanneer en waarmee iemand kan helpen. Deze afspraken laten de app geen berichten sturen en betekenen niet dat iemand altijd bereikbaar is." : "Agree together when and how someone can help. These notes do not make the app send messages or mean someone is always available."}</p>
    {emergencyContacts.map(contact => <div className="rounded-xl border border-border bg-card p-3 space-y-2" key={contact.id}>
      <p className="font-medium text-sm">{contact.name}</p><p className="text-xs text-muted-foreground">{contact.relationship} · {contact.phone}</p>
      {(contact.role || contact.availability) && <p className="text-xs text-muted-foreground">{[contact.role, contact.availability].filter(Boolean).join(" · ")}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" disabled={saving || draft !== null} className="touch-target rounded-lg border px-3 py-2 text-xs disabled:opacity-50" onClick={() => { setDraft({ ...contact }); setRemoving(null); setError(""); }}>{nl ? "Bewerken" : "Edit"}</button>
        <button type="button" disabled={saving || draft !== null} className="touch-target rounded-lg border px-3 py-2 text-xs disabled:opacity-50" onClick={() => setRemoving(contact.id)}>{nl ? "Verwijderen" : "Remove"}</button></div>
      {removing === contact.id && <div className="space-y-2"><p className="text-xs">{nl ? `Contact ${contact.name} verwijderen? Controleer daarna de contactafspraken in Mijn plan.` : `Remove ${contact.name}? Check the contact agreements in My plan afterwards.`}</p><div className="flex gap-2"><button type="button" disabled={saving} className="touch-target rounded-lg bg-destructive px-3 py-2 text-xs text-destructive-foreground" onClick={() => remove(contact.id)}>{nl ? "Contact verwijderen" : "Remove contact"}</button><button type="button" className="touch-target px-3 py-2 text-xs" onClick={() => setRemoving(null)}>{nl ? "Annuleren" : "Cancel"}</button></div></div>}
    </div>)}
    {!draft && emergencyContacts.length < 50 && <button type="button" disabled={saving} className="touch-target rounded-xl border border-primary/30 px-4 py-3 text-sm text-primary" onClick={() => { setDraft(blank()); setRemoving(null); setError(""); }}>{nl ? "Steunpersoon toevoegen" : "Add support person"}</button>}
    {draft && <fieldset disabled={saving} className="space-y-3 rounded-xl border border-border bg-card p-4"><legend className="text-sm">{nl ? "Contact en afspraken" : "Contact and agreements"}</legend>
      <p className="text-xs text-muted-foreground">{nl ? "Sla dit contact op of annuleer voordat je een ander contact bewerkt." : "Save or cancel this contact before editing another contact."}</p>
      {([['name', 'Naam', 'Name'], ['relationship', 'Relatie tot mij', 'Relationship'], ['phone', 'Telefoonnummer', 'Phone'], ['role', 'Waarmee helpt deze persoon?', 'How does this person help?'], ['availability', 'Wanneer kan ik contact opnemen?', 'When can I contact them?'], ['supportNotes', 'Onze afspraken', 'Our agreements'], ['fallback', 'Als deze persoon niet bereikbaar is', 'If this person is unavailable']] as const).map(([key, dutch, english]) => <label className="block text-xs" key={key}>{nl ? dutch : english}<input type={key === 'phone' ? 'tel' : 'text'} className={input} maxLength={500} value={draft[key] ?? ""} onChange={e => update(key, e.target.value)} /></label>)}
      <label className="block text-xs">{nl ? "Contactgegevens in een gekozen rapport" : "Contact details in a chosen report"}<select aria-label={nl ? "Contactgegevens in een gekozen rapport" : "Contact details in a chosen report"} className={input} value={draft.sharingPreference ?? "unanswered"} onChange={e => update("sharingPreference", e.target.value)}>
        <option value="unanswered">{nl ? "Nog niet afgesproken" : "Not agreed yet"}</option><option value="ask-first">{nl ? "Eerst samen bespreken" : "Discuss first"}</option><option value="may-share">{nl ? "Mag in een rapport dat ik kies" : "May be included in a report I choose"}</option><option value="keep-private">{nl ? "Privé houden in rapporten" : "Keep private in reports"}</option>
      </select></label>
      <p className="text-xs text-muted-foreground">{nl ? "Een volledige back-up bewaart ook deze gegevens, zodat je ze kunt herstellen. Deze voorkeur is geen toestemming om berichten te versturen." : "A full backup includes these details so you can restore them. This preference is not permission to send messages."}</p>
      <div className="flex gap-2"><button type="button" disabled={saving || !!localDraft.error} className="touch-target rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground" onClick={save}>{saving ? (nl ? "Opslaan…" : "Saving…") : (nl ? "Opslaan" : "Save")}</button><button type="button" disabled={saving} className="touch-target rounded-xl border px-4 py-3 text-sm" onClick={() => { void localDraft.clearDraft(null).catch(() => setError(nl ? "Het concept kon niet worden gewist." : "The draft could not be cleared.")); }}>{nl ? "Annuleren" : "Cancel"}</button></div>
    </fieldset>}
    <ContactDraftStatus error={localDraft.error} conflict={localDraft.conflict} retry={localDraft.retry} keepMine={localDraft.keepMine} language={language} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
