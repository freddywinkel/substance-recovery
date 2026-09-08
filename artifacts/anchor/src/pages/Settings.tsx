import { useState, useEffect, useRef } from "react";
import { useStore } from "@/hooks/useStore";
import { usePWA } from "@/hooks/usePWA";
import { useLanguage } from "@/contexts/LanguageContext";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import {
  Moon, Sun, Download, Trash2, Shield, Calendar,
  Languages, FileDown,
  CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { useLocation } from "wouter";
import { ImportDataPanel } from "@/components/ImportDataPanel";
import { PersonalContactsSettings } from "@/components/PersonalContactsSettings";
import { CareContactSettings } from "@/components/CareContactSettings";
import { flushLocalDrafts, resetLocalDraftMemory } from "@/lib/localDrafts";
import { useLocalDraft } from "@/hooks/useLocalDraft";
import { DraftStatus } from "@/components/DraftStatus";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { isJourneyDateDraft, isValidSettingsDate, localSettingsDate, performSettingsReset } from "@/lib/settingsActions";

const LAST_EXPORTED_KEY = "substance-recovery:last-exported";

export function Settings() {
  const {
    theme, setTheme, resetAllData, sobrietyStartDate, setSobrietyStartDate,
    exportData, importData, loading,
  } = useStore();
  const { installPrompt, isInstalled, install } = usePWA();
  const { language, setLanguage } = useLanguage();
  const { t } = useT();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [confirmReset, setConfirmReset] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);
  const dateDraft = useLocalDraft("journey-date", sobrietyStartDate ?? "", { ready: !loading, validate: isJourneyDateDraft });
  const dateInput = dateDraft.value;
  const dateSavingRef = useRef(false);
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState("");
  const [themeError, setThemeError] = useState("");
  const [themeSaving, setThemeSaving] = useState(false);
  const themeSavingRef = useRef(false);
  const [failedTheme, setFailedTheme] = useState<"dark" | "light" | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetCommitted, setResetCommitted] = useState(false);
  const resetBusyRef = useRef(false);
  const [resetError, setResetError] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const exportBusyRef = useRef(false);

  const [lastExported, setLastExported] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error">("idle");
  useEffect(() => {
    try { const stored = localStorage.getItem(LAST_EXPORTED_KEY); if (stored) setLastExported(stored); } catch { /* Export metadata is optional. */ }
  }, []);

  const handleReset = async () => {
    if (resetBusyRef.current || resetCommitted) return;
    resetBusyRef.current = true; setResetBusy(true); setResetError("");
    const result = await performSettingsReset({
      flush: flushLocalDrafts, erase: resetAllData,
      committed: () => { setResetCommitted(true); setLastExported(null); },
      clearDraftMemory: resetLocalDraftMemory,
      clearBrowserMetadata: () => {
        for (const key of ["anchor-pinned-tools", LAST_EXPORTED_KEY]) {
          try { localStorage.removeItem(key); } catch { /* Optional display metadata. */ }
        }
      },
      reload: () => window.location.reload(),
    });
    if (!result.committed) {
      setResetError(t("settings.reset.error"));
      toast({ title: t("settings.reset.error"), variant: "destructive" });
    } else {
      setResetError(language === "nl" ? "De lokale appgegevens zijn gewist. Herlaad de app als dit niet automatisch gebeurt." : "Local app data has been erased. Reload the app if it does not reload automatically.");
    }
    resetBusyRef.current = false; setResetBusy(false);
  };

  const handleExport = async () => {
    if (exportBusyRef.current || resetBusyRef.current || resetCommitted) return;
    exportBusyRef.current = true; setExportBusy(true);
    setExportStatus("idle");
    try {
      await flushLocalDrafts();
      const data = await exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `substance-recovery-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      try { localStorage.setItem(LAST_EXPORTED_KEY, now); } catch { /* A downloaded backup is still successful. */ }
      setLastExported(now);
      setExportStatus("success");
      toast({
        title: t("export.success"),
        description: t("export.subtitle"),
      });
      setTimeout(() => setExportStatus("idle"), 3000);
    } catch {
      setExportStatus("error");
      toast({
        title: t("export.error"),
        variant: "destructive",
      });
      setTimeout(() => setExportStatus("idle"), 5000);
    } finally {
      exportBusyRef.current = false; setExportBusy(false);
    }
  };

  const handleDateSave = async () => {
    if (loading || !dateDraft.hydrated || dateDraft.conflict || dateSavingRef.current || resetBusyRef.current || resetCommitted || !dateDraft.hasDraft) return;
    const val = dateInput.trim();
    if (!isValidSettingsDate(val)) { setDateError(language === "nl" ? "Kies een geldige datum die niet in de toekomst ligt." : "Choose a valid date that is not in the future."); return; }
    dateSavingRef.current = true; setDateSaving(true); setDateError("");
    let committed = false;
    try {
      await flushLocalDrafts();
      await setSobrietyStartDate(val || null);
      committed = true;
      await dateDraft.clearDraft(val);
    }
    catch { setDateError(committed
      ? (language === "nl" ? "De datum is opgeslagen, maar het concept kon niet worden afgerond. Je invoer blijft bewaard." : "The date was saved, but its draft could not be cleared. Your input is preserved.")
      : (language === "nl" ? "De datum is niet opgeslagen. Je invoer blijft staan; probeer opnieuw." : "The date was not saved. Your input remains; please retry.")); }
    finally { dateSavingRef.current = false; setDateSaving(false); }
  };

  const handleThemeSave = async (nextTheme: "dark" | "light") => {
    if (loading || themeSavingRef.current || resetBusyRef.current) return;
    themeSavingRef.current = true; setThemeSaving(true); setThemeError(""); setFailedTheme(nextTheme);
    try { await setTheme(nextTheme); setFailedTheme(null); }
    catch { setThemeError(language === "nl" ? "Het thema is niet opgeslagen. Je huidige thema blijft behouden; probeer opnieuw." : "The theme was not saved. Your current theme is preserved; please retry."); }
    finally { themeSavingRef.current = false; setThemeSaving(false); }
  };

  const todayStr = localSettingsDate();

  const formatLastExported = (iso: string | null) => {
    if (!iso) return t("export.lastExported") + ": never";
    const date = new Date(iso);
    const dateStr = date.toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
    const timeStr = date.toLocaleTimeString(language === "nl" ? "nl-NL" : "en-GB", {
      hour: "2-digit", minute: "2-digit",
    });
    return `${t("export.lastExported")}: ${dateStr} · ${timeStr}`;
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("settings.title")} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-safe flex flex-col gap-4">

        {/* Sobriety */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.sobriety")}</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Calendar size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.sobriety.label")}</p>
                <p id="journey-date-description" className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {t("settings.sobriety.sub")}
                </p>
              </div>
            </div>
            <input
              type="date"
              aria-label={t("settings.sobriety.label")}
              aria-describedby={`journey-date-description${dateError ? " journey-date-error" : ""}`}
              aria-invalid={!!dateError}
              value={resetCommitted ? "" : dateInput}
              max={todayStr}
              disabled={loading || !dateDraft.hydrated || (!!dateDraft.error && !dateDraft.hasDraft) || dateSaving || resetBusy || resetCommitted}
              onChange={(e) => { dateDraft.setValue(e.target.value); setDateError(""); }}
              onBlur={handleDateSave}
              className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none [color-scheme:inherit]"
            />
            {dateSaving && <p role="status" className="text-xs text-muted-foreground">{language === "nl" ? "Datum opslaan…" : "Saving date…"}</p>}
            {!resetCommitted && <DraftStatus {...dateDraft} />}
            {dateError && <p id="journey-date-error" role="alert" className="text-xs text-destructive">{dateError}</p>}
            {!resetCommitted && (dateDraft.hasDraft || dateError) && <button type="button" disabled={dateSaving || dateDraft.conflict} onClick={handleDateSave} className="min-h-11 self-start text-sm underline">{language === "nl" ? "Datum opslaan" : "Save date"}</button>}
            {sobrietyStartDate && (
              <p className="text-xs text-primary leading-snug break-words">
                {t("settings.sobriety.saved")} {new Date(sobrietyStartDate + "T00:00:00").toLocaleDateString(language === "nl" ? "nl-NL" : "en-GB", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </p>
            )}
          </div>
        </section>

        {/* Appearance */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.appearance")}</p>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {theme === "dark" ? <Moon size={18} className="shrink-0" /> : <Sun size={18} className="shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {theme === "dark" ? t("settings.theme.dark") : t("settings.theme.light")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {theme === "dark" ? t("settings.theme.dark_sub") : t("settings.theme.light_sub")}
                  </p>
                </div>
              </div>
              <button
                disabled={loading || themeSaving || resetBusy || resetCommitted}
                onClick={() => handleThemeSave(theme === "dark" ? "light" : "dark")}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors touch-target ${
                  theme === "light" ? "bg-primary" : "bg-muted"
                }`}
                role="switch"
                aria-checked={theme === "light"}
                aria-label={t("settings.theme.aria")}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    theme === "light" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {themeError && <div><p role="alert" className="mt-3 text-xs text-destructive">{themeError}</p><button type="button" disabled={themeSaving} onClick={() => handleThemeSave(failedTheme ?? (theme === "dark" ? "light" : "dark"))} className="min-h-11 text-sm underline">{language === "nl" ? "Opnieuw opslaan" : "Retry saving"}</button></div>}
          </div>
        </section>

        {/* Language */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.language")}</p>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <Languages size={18} className="text-primary shrink-0" />
              <p className="text-sm font-medium text-foreground">
                {language === "nl" ? "Taal / Language" : "Language / Taal"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage("nl")}
                aria-pressed={language === "nl"}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all touch-target ${
                  language === "nl"
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-background border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                🇳🇱 Nederlands
              </button>
              <button
                onClick={() => setLanguage("en")}
                aria-pressed={language === "en"}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all touch-target ${
                  language === "en"
                    ? "bg-primary/10 border-primary text-foreground"
                    : "bg-background border-border text-muted-foreground hover:border-primary/30"
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>
        </section>

        {/* Install */}
        {!isInstalled && installPrompt && (
          <section>
            <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.install")}</p>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Download size={18} className="text-primary mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{t("settings.install.title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {t("settings.install.sub")}
                  </p>
                </div>
              </div>
              <button
                onClick={install}
                className="mt-4 w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target"
              >
                {t("settings.install.btn")}
              </button>
            </div>
          </section>
        )}

        <CareContactSettings />

        <PersonalContactsSettings />

        {/* Privacy */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.privacy")}</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Shield size={18} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.privacy.title")}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t("settings.privacy.body")}
                </p>
              </div>
            </div>
            <div className="border-t border-border/50 pt-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("settings.privacy.footer")}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/privacy')}
            className="mt-2 w-full flex items-center justify-between px-4 py-3 bg-card border border-border rounded-2xl text-sm text-foreground hover:bg-muted/40 transition-colors touch-target"
          >
            <span>{t('settings.privacy.viewPolicy')}</span>
            <span className="text-muted-foreground">→</span>
          </button>
        </section>

        {/* Export / Import — redesigned with cards */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("export.title")}</p>
          <div className="flex flex-col gap-3">
            {/* Export card */}
            <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                  <FileDown size={18} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t("export.btn")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("export.subtitle")}</p>
                </div>
              </div>
              <button
                onClick={handleExport}
                disabled={exportBusy || resetBusy || resetCommitted || loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <FileDown size={16} />
                {t("export.btn")}
              </button>
              {lastExported && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>{formatLastExported(lastExported)}</span>
                </div>
              )}
              {exportStatus === "success" && (
                <div className="flex items-center gap-2 text-xs text-primary animate-fade-up">
                  <CheckCircle2 size={14} />
                  <span>{t("export.success")}</span>
                </div>
              )}
              {exportStatus === "error" && (
                <div className="flex items-center gap-2 text-xs text-destructive animate-fade-up">
                  <AlertCircle size={14} />
                  <span>{t("export.error")}</span>
                </div>
              )}
            </div>

            <ImportDataPanel onImport={importData} />
          </div>
        </section>

        {/* Data management */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.data")}</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              disabled={loading || exportBusy || dateSaving || themeSaving || resetBusy || resetCommitted}
              ref={resetTriggerRef}
              onClick={() => { setResetError(""); setConfirmReset(true); }}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-destructive/5 transition-colors touch-target"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-destructive">{t("settings.data.erase")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("settings.data.erase_sub")}
                </p>
              </div>
              <Trash2 size={16} strokeWidth={1.8} className="text-destructive shrink-0" />
            </button>
          </div>
        </section>

        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground">
            {t("settings.footer")}
          </p>
          <p className="text-xs text-muted-foreground/50 mt-1">
            {t("settings.footer_sub")}
          </p>
        </div>

        <div className="h-4" />
      </div>

      {/* Confirm reset dialog */}
      <AlertDialog open={confirmReset} onOpenChange={open => { if (!resetBusy && !resetCommitted) setConfirmReset(open); }}>
          <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); resetTriggerRef.current?.focus(); }} onEscapeKeyDown={event => { if (resetBusy || resetCommitted) event.preventDefault(); }} className="z-[80] max-h-[85dvh] overflow-y-auto bg-card border border-border rounded-3xl p-6 w-[calc(100%_-_2rem)] max-w-sm">
            <AlertDialogTitle className="font-semibold text-foreground mb-1">{t("settings.reset.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mb-5 leading-relaxed">
              {t("settings.reset.body")}
            </AlertDialogDescription>
            {resetError && <p role={resetCommitted ? "status" : "alert"} className="mb-3 text-sm">{resetError}</p>}
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel disabled={resetBusy || resetCommitted} className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
              <button
                disabled={resetBusy}
                onClick={resetCommitted ? () => window.location.reload() : handleReset}
                className="flex-1 bg-destructive text-destructive-foreground rounded-xl py-3 font-semibold touch-target"
              >
                {resetBusy ? (language === "nl" ? "Gegevens wissen…" : "Erasing data…") : resetCommitted ? (language === "nl" ? "App herladen" : "Reload app") : t("settings.reset.confirm")}
              </button>
            </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
