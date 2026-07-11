import { useState, useEffect } from "react";
import { useStore } from "@/hooks/useStore";
import { usePWA } from "@/hooks/usePWA";
import { useLanguage } from "@/contexts/LanguageContext";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { useReminders } from "@/hooks/useReminders";
import { useToast } from "@/hooks/use-toast";
import {
  Moon, Sun, Download, Trash2, Phone, Shield, Calendar,
  Languages, UserPlus, X, Upload, Bell, FileDown,
  FileUp, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { EmergencyContact } from "@/db";
import { DEFAULT_CRISIS_SERVICES } from "@/lib/crisisServices";
import { useLocation } from "wouter";

const LAST_EXPORTED_KEY = "substance-recovery:last-exported";

export function Settings() {
  const {
    theme, setTheme, resetAllData, sobrietyStartDate, setSobrietyStartDate,
    crisisService, setCrisisService, emergencyContacts, setEmergencyContacts,
    exportData, importData,
  } = useStore();
  const { installPrompt, isInstalled, install } = usePWA();
  const { language, setLanguage } = useLanguage();
  const { t } = useT();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [confirmReset, setConfirmReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [dateInput, setDateInput] = useState(sobrietyStartDate ?? "");

  const [lastExported, setLastExported] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");
  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<Record<string, unknown> | null>(null);

  const { settings: reminderSettings, saveSettings: saveReminderSettings, permission: reminderPermission, requestPermission: requestReminderPermission } = useReminders();

  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customNumber, setCustomNumber] = useState("");
  const [customNameError, setCustomNameError] = useState("");
  const [customNumberError, setCustomNumberError] = useState("");

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRelation, setContactRelation] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const stored = localStorage.getItem(LAST_EXPORTED_KEY);
    if (stored) setLastExported(stored);
  }, []);

  useEffect(() => {
    if (crisisService) {
      if (crisisService.isCustom) {
        setSelectedServiceId("custom");
        setCustomName(crisisService.name);
        setCustomNumber(crisisService.number);
      } else {
        setSelectedServiceId(crisisService.id);
      }
    }
  }, [crisisService]);

  const handleReset = async () => {
    await resetAllData({ signedIn: false, userId: null });
    setConfirmReset(false);
    setResetDone(true);
    setDateInput("");
    setSelectedServiceId("");
    setCustomName("");
    setCustomNumber("");
  };

  const handleExport = async () => {
    setExportStatus("idle");
    try {
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
      localStorage.setItem(LAST_EXPORTED_KEY, now);
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
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(String(ev.target?.result ?? "{}"));
        if (!payload || typeof payload !== "object" || !payload.version) {
          setImportStatus("error");
          setImportMessage(t("import.error"));
          toast({
            title: t("import.error"),
            variant: "destructive",
          });
          return;
        }
        setPendingImport(payload);
        setImportConfirm(true);
      } catch {
        setImportStatus("error");
        setImportMessage(t("import.error"));
        toast({
          title: t("import.error"),
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = async () => {
    if (!pendingImport) return;
    setImportConfirm(false);
    try {
      const result = await importData(pendingImport);
      setImportStatus("success");
      setImportMessage(t("import.success").replace("{n}", String(result.imported)));
      toast({
        title: t("import.success"),
        description: `${result.imported} items restored`,
      });
      setPendingImport(null);
      setTimeout(() => setImportStatus("idle"), 3000);
    } catch {
      setImportStatus("error");
      setImportMessage(t("import.error"));
      toast({
        title: t("import.error"),
        variant: "destructive",
      });
      setPendingImport(null);
      setTimeout(() => setImportStatus("idle"), 5000);
    }
  };

  const handleDateSave = async () => {
    const val = dateInput.trim();
    await setSobrietyStartDate(val || null);
  };

  const handleServiceChange = async (id: string) => {
    setSelectedServiceId(id);
    setCustomNameError("");
    setCustomNumberError("");
    if (id === "custom") {
      setCustomName("");
      setCustomNumber("");
      return;
    }
    const svc = DEFAULT_CRISIS_SERVICES.find((s) => s.id === id);
    if (svc) {
      await setCrisisService({ id: svc.id, name: t(svc.nameKey), number: svc.number, isCustom: false });
    }
  };

  const handleCustomSave = async () => {
    let valid = true;
    setCustomNameError("");
    setCustomNumberError("");
    if (!customName.trim()) {
      setCustomNameError(t("settings.emergencyContacts.name"));
      valid = false;
    }
    const digits = customNumber.replace(/\D/g, "");
    if (digits.length < 3) {
      setCustomNumberError(t("settings.crisisService.customNumber"));
      valid = false;
    }
    if (!valid) return;
    await setCrisisService({ id: "custom", name: customName.trim(), number: customNumber.trim(), isCustom: true });
  };

  const handleAddContact = async () => {
    const errors: Record<string, string> = {};
    if (!contactName.trim()) errors.name = "required";
    if (!contactRelation.trim()) errors.relationship = "required";
    const digits = contactPhone.replace(/\D/g, "");
    if (!contactPhone.trim() || digits.length < 3) errors.phone = "invalid";
    setContactErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const newContact: EmergencyContact = {
      id: crypto.randomUUID(),
      name: contactName.trim(),
      relationship: contactRelation.trim(),
      phone: contactPhone.trim(),
    };
    await setEmergencyContacts([...emergencyContacts, newContact]);
    setContactName("");
    setContactRelation("");
    setContactPhone("");
    setContactErrors({});
    setShowContactForm(false);
  };

  const handleRemoveContact = async (id: string) => {
    await setEmergencyContacts(emergencyContacts.filter((c) => c.id !== id));
  };

  const todayStr = new Date().toISOString().slice(0, 10);

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
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {t("settings.sobriety.sub")}
                </p>
              </div>
            </div>
            <input
              type="date"
              value={dateInput}
              max={todayStr}
              onChange={(e) => setDateInput(e.target.value)}
              onBlur={handleDateSave}
              className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none [color-scheme:inherit]"
            />
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {theme === "dark" ? t("settings.theme.dark") : t("settings.theme.light")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {theme === "dark" ? t("settings.theme.dark_sub") : t("settings.theme.light_sub")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-target ${
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

        {/* ── Crisis Service picker ──────────────────────────── */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.crisisService")}</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.crisisService.description")}</p>
            <select
              value={selectedServiceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none"
            >
              <option value="">{t("settings.crisisService.choose")}</option>
              {DEFAULT_CRISIS_SERVICES.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {t(svc.nameKey)} — {svc.number}
                </option>
              ))}
              <option value="custom">{t("settings.crisisService.custom")}</option>
            </select>

            {selectedServiceId === "custom" && (
              <div className="flex flex-col gap-2 pt-1">
                <div>
                  <input
                    type="text"
                    placeholder={t("settings.crisisService.customName")}
                    aria-label="Crisis service name"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className={`w-full bg-background border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      customNameError ? "border-destructive" : "border-input"
                    }`}
                  />
                  {customNameError && <p className="text-xs text-destructive mt-1">{t("settings.emergencyContacts.name")} {language === "nl" ? "is verplicht" : "is required"}</p>}
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder={t("settings.crisisService.customNumber")}
                    aria-label="Crisis service phone"
                    value={customNumber}
                    onChange={(e) => setCustomNumber(e.target.value)}
                    className={`w-full bg-background border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      customNumberError ? "border-destructive" : "border-input"
                    }`}
                  />
                  {customNumberError && <p className="text-xs text-destructive mt-1">{language === "nl" ? "Minimaal 3 cijfers vereist" : "Minimum 3 digits required"}</p>}
                </div>
                <button
                  onClick={handleCustomSave}
                  className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target"
                >
                  {language === "nl" ? "Opslaan" : "Save"}
                </button>
              </div>
            )}

            {crisisService && !crisisService.isCustom && selectedServiceId && selectedServiceId !== "custom" && (
              <p className="text-xs text-primary leading-snug">
                ✓ {crisisService.name} — {crisisService.number}
              </p>
            )}
            {crisisService?.isCustom && selectedServiceId === "custom" && crisisService.name && (
              <p className="text-xs text-primary leading-snug">
                ✓ {crisisService.name} — {crisisService.number}
              </p>
            )}
          </div>
        </section>

        {/* ── Emergency Contacts ────────────────────────────── */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.emergencyContacts")}</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{t("settings.emergencyContacts.description")}</p>

            {/* Existing contacts */}
            {emergencyContacts.length > 0 && (
              <div className="flex flex-col gap-2">
                {emergencyContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 bg-background border border-border rounded-xl px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.relationship} · {contact.phone}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveContact(contact.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-1 touch-target"
                      aria-label={t("settings.emergencyContacts.remove")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add contact form */}
            {showContactForm ? (
              <div className="flex flex-col gap-2 border border-border rounded-xl p-3">
                <div>
                  <input
                    type="text"
                    placeholder={t("settings.emergencyContacts.name")}
                    aria-label="Emergency contact name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={`w-full bg-background border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      contactErrors.name ? "border-destructive" : "border-input"
                    }`}
                  />
                  {contactErrors.name && <p className="text-xs text-destructive mt-1">{language === "nl" ? "Naam is verplicht" : "Name is required"}</p>}
                </div>
                <div>
                  <input
                    type="text"
                    placeholder={t("settings.emergencyContacts.relationship")}
                    aria-label="Emergency contact relationship"
                    value={contactRelation}
                    onChange={(e) => setContactRelation(e.target.value)}
                    className={`w-full bg-background border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      contactErrors.relationship ? "border-destructive" : "border-input"
                    }`}
                  />
                  {contactErrors.relationship && <p className="text-xs text-destructive mt-1">{language === "nl" ? "Relatie is verplicht" : "Relationship is required"}</p>}
                </div>
                <div>
                  <input
                    type="tel"
                    placeholder={t("settings.emergencyContacts.phone")}
                    aria-label="Emergency contact phone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className={`w-full bg-background border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
                      contactErrors.phone ? "border-destructive" : "border-input"
                    }`}
                  />
                  {contactErrors.phone && <p className="text-xs text-destructive mt-1">{language === "nl" ? "Minimaal 3 cijfers vereist" : "Minimum 3 digits required"}</p>}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowContactForm(false); setContactErrors({}); }}
                    className="flex-1 border border-border rounded-xl py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors touch-target"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleAddContact}
                    className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all touch-target"
                  >
                    {language === "nl" ? "Opslaan" : "Save"}
                  </button>
                </div>
              </div>
            ) : emergencyContacts.length < 3 ? (
              <button
                onClick={() => setShowContactForm(true)}
                className="flex items-center justify-center gap-2 w-full border border-dashed border-border rounded-xl py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors touch-target"
              >
                <UserPlus size={16} />
                {t("settings.emergencyContacts.add")}
              </button>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-1">{t("settings.emergencyContacts.max")}</p>
            )}
          </div>
        </section>

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

            {/* Import card */}
            <div className="rounded-[1.5rem] border border-border/50 bg-card/50 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary shrink-0">
                  <FileUp size={18} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{t("import.btn")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("import.subtitle")}</p>
                </div>
              </div>
              <label className="flex items-center justify-center gap-2 border border-border rounded-xl py-3 font-medium text-sm text-foreground hover:bg-muted/40 transition-colors touch-target cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                <FileUp size={16} />
                {t("import.btn")}
                <input type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
              </label>
              {importStatus === "success" && (
                <div className="flex items-center gap-2 text-xs text-primary animate-fade-up">
                  <CheckCircle2 size={14} />
                  <span>{importMessage || t("import.success")}</span>
                </div>
              )}
              {importStatus === "error" && (
                <div className="flex items-center gap-2 text-xs text-destructive animate-fade-up">
                  <AlertCircle size={14} />
                  <span>{importMessage || t("import.error")}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Reminders */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("reminder.section")}</p>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Bell size={18} className="text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t("reminder.title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("reminder.subtitle")}</p>
              </div>
            </div>

            {!("Notification" in window) ? (
              <p className="text-xs text-muted-foreground">{t("reminder.no_support")}</p>
            ) : (
              <>
                <div className="bg-background border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{t("reminder.enable")}</span>
                    <button
                      onClick={() => {
                        const next = !reminderSettings.enabled;
                        saveReminderSettings({ ...reminderSettings, enabled: next });
                      }}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-target ${
                        reminderSettings.enabled ? "bg-primary" : "bg-muted"
                      }`}
                      role="switch"
                      aria-checked={reminderSettings.enabled}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          reminderSettings.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {reminderSettings.enabled && (
                  <div className="bg-background border border-border rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm text-foreground">{t("reminder.time")}</span>
                    <input
                      type="time"
                      value={reminderSettings.time}
                      onChange={(e) => {
                        const next = e.target.value;
                        saveReminderSettings({ ...reminderSettings, time: next });
                      }}
                      className="bg-background border border-input rounded-xl px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none [color-scheme:inherit]"
                    />
                  </div>
                )}

                {reminderPermission === "granted" ? (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <CheckCircle2 size={12} />
                    <span>{t("reminder.permission.granted")}</span>
                  </div>
                ) : reminderPermission === "denied" ? (
                  <p className="text-xs text-destructive">{t("reminder.permission.denied")}</p>
                ) : (
                  <button
                    onClick={async () => {
                      const granted = await requestReminderPermission();
                      if (!granted) {
                        saveReminderSettings({ ...reminderSettings, enabled: false });
                      }
                    }}
                    className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target"
                  >
                    <Bell size={14} />
                    {t("reminder.permission")}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* Data management */}
        <section>
          <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.data")}</p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
              onClick={() => setConfirmReset(true)}
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

        {resetDone && (
          <p className="text-center text-sm text-muted-foreground animate-fade-up">
            {t("settings.data.erased")}
          </p>
        )}

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
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm px-4 pb-8">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-foreground mb-1">{t("settings.reset.title")}</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              {t("settings.reset.body")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 border border-border rounded-xl py-3 font-medium text-foreground touch-target"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 bg-destructive text-destructive-foreground rounded-xl py-3 font-semibold touch-target"
              >
                {t("settings.reset.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm import dialog */}
      {importConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm px-4 pb-8">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-foreground mb-1">{t("import.confirm.title")}</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              {t("import.confirm.body")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setImportConfirm(false); setPendingImport(null); }}
                className="flex-1 border border-border rounded-xl py-3 font-medium text-foreground touch-target"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleImportConfirm}
                className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold touch-target"
              >
                {t("import.confirm.btn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
