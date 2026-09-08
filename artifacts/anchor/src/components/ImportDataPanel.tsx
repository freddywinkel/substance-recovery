import { useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { previewImportData, exportAllData, type ImportMode, type ImportPreview, type ImportResult } from "@/db";
import { flushLocalDrafts, resetLocalDraftMemory } from "@/lib/localDrafts";

export function ImportDataPanel({ onImport }: { onImport: (payload: Record<string, unknown>, options: { mode: ImportMode }) => Promise<ImportResult> }) {
  const { language } = useLanguage(); const nl = language === "nl";
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [error, setError] = useState(""); const [committed, setCommitted] = useState(false);
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(""); setPreview(null); setPayload(null); setCommitted(false); setAcknowledged(false);
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error(nl ? "Dit bestand is groter dan 50 MB. Gebruik een kleinere back-up of vraag ondersteuning." : "This file exceeds 50 MB. Use a smaller backup or seek support.");
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(nl ? "Geen geldig back-upobject." : "Invalid backup object.");
      const value = parsed as Record<string, unknown>;
      setPreview(await previewImportData(value)); setPayload(value);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  };
  const saveCurrentBackup = async () => {
    setError("");
    try {
      await flushLocalDrafts();
      const data = await exportAllData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = `anchor-before-import-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const commit = async () => {
    if (!payload || !preview?.canImport || busyRef.current || (mode === "replace" && !acknowledged)) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      await flushLocalDrafts();
      const result = await onImport(payload, { mode });
      if (!result.committed) setError(result.errors.join("\n"));
      else { resetLocalDraftMemory(); setCommitted(true); setPayload(null); setPreview(null); window.location.reload(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <section className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-labelledby="import-panel-title">
    <h2 id="import-panel-title" className="font-semibold">{nl ? "Back-up controleren en herstellen" : "Check and restore a backup"}</h2>
    <p className="text-sm text-muted-foreground">{nl ? "Je ziet eerst wat er verandert. Een ongeldige back-up wijzigt niets. De back-up bevat ook gevoelige tekst en lokale concepten." : "Review changes first. An invalid backup changes nothing. Backups also contain sensitive text and local drafts."}</p>
    <label className="block text-sm">{nl ? "JSON-back-up kiezen" : "Choose JSON backup"}<input type="file" accept=".json,application/json" disabled={busy || committed} onChange={event => { void readFile(event.target.files?.[0]); event.target.value = ""; }} className="block mt-2 w-full" /></label>
    {busy && <p role="status">{nl ? "Bezig..." : "Working..."}</p>}
    {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
    {preview && <>
      <p className="text-sm">{nl ? `${preview.incoming} te herstellen onderdelen; ${preview.existing} bestaande onderdelen; ${preview.conflicts} gelijke IDs/sleutels.` : `${preview.incoming} incoming items; ${preview.existing} existing items; ${preview.conflicts} matching IDs/keys.`}</p>
      <details><summary>{nl ? "Aantallen per onderdeel" : "Counts by section"}</summary><ul className="text-sm list-disc pl-5">{Object.entries(preview.counts).map(([key,count]) => <li key={key}>{key}: {count}</li>)}</ul></details>
      {!!preview.errors.length && <div role="alert"><p>{nl ? "Import geblokkeerd; er is niets gewijzigd." : "Import blocked; nothing has changed."}</p><ul className="text-sm list-disc pl-5">{preview.errors.map((item,index) => <li key={index}>{item}</li>)}</ul></div>}
      {!!preview.warnings.length && <ul className="text-sm list-disc pl-5">{preview.warnings.map((item,index) => <li key={index}>{item}</li>)}</ul>}
      {preview.canImport && <>
        <fieldset disabled={busy} className="space-y-2"><legend>{nl ? "Hoe herstellen?" : "Restore mode"}</legend>
          <label className="flex gap-2"><input type="radio" name="restore-mode" checked={mode === "merge"} onChange={() => { setMode("merge"); setAcknowledged(false); }} /><span>{nl ? "Samenvoegen: gelijke record-IDs en instellingen worden vervangen; andere records en contact-IDs blijven." : "Merge: matching record IDs and settings are replaced; other records and contact IDs remain."}</span></label>
          <label className="flex gap-2"><input type="radio" name="restore-mode" checked={mode === "replace"} onChange={() => setMode("replace")} /><span>{nl ? "Vervangen: alle huidige appgegevens worden vervangen door dit bestand, ook concepten en contacten." : "Replace: all current app data is replaced by this file, including drafts and contacts."}</span></label>
        </fieldset>
        <button type="button" onClick={() => void saveCurrentBackup()} disabled={busy} className="underline min-h-11">{nl ? "Eerst huidige back-up downloaden" : "Download current backup first"}</button>
        {mode === "replace" && <label className="flex gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} /><span>{nl ? "Ik begrijp dat huidige gegevens die niet in dit bestand staan worden verwijderd." : "I understand that current data absent from this file will be removed."}</span></label>}
        <div className="flex gap-3"><button type="button" disabled={busy || (mode === "replace" && !acknowledged)} onClick={() => void commit()} className="rounded-xl bg-primary text-primary-foreground px-4 min-h-11 disabled:opacity-50">{nl ? "Herstel bevestigen" : "Confirm restore"}</button><button type="button" disabled={busy} onClick={() => { setPayload(null); setPreview(null); }} className="underline">{nl ? "Annuleren" : "Cancel"}</button></div>
      </>}
    </>}
    {committed && <div role="status"><p>{nl ? "Herstel opgeslagen. Herlaad de app om alle instellingen en concepten te openen." : "Restore saved. Reload the app to open all restored settings and drafts."}</p><button type="button" onClick={() => window.location.reload()} className="underline min-h-11">{nl ? "App herladen" : "Reload app"}</button></div>}
  </section>;
}
