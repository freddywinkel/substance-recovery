import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { Database, Shield, Lock, Trash2, Clock, Mail } from "lucide-react";

export function PrivacyPolicy() {
  const { t } = useT();

  const sections = [
    {
      icon: <Database size={18} className="text-primary mt-0.5 shrink-0" />,
      title: t("privacy.collected.title"),
      body: t("privacy.collected.body"),
    },
    {
      icon: <Shield size={18} className="text-primary mt-0.5 shrink-0" />,
      title: t("privacy.storage.title"),
      body: t("privacy.storage.body"),
    },
    {
      icon: <Lock size={18} className="text-primary mt-0.5 shrink-0" />,
      title: t("privacy.access.title"),
      body: t("privacy.access.body"),
    },
    {
      icon: <Trash2 size={18} className="text-primary mt-0.5 shrink-0" />,
      title: t("privacy.delete.title"),
      body: t("privacy.delete.body"),
    },
    {
      icon: <Clock size={18} className="text-primary mt-0.5 shrink-0" />,
      title: t("privacy.retention.title"),
      body: t("privacy.retention.body"),
    },
    {
      icon: <Mail size={18} className="text-primary mt-0.5 shrink-0" />,
      title: t("privacy.contact.title"),
      body: t("privacy.contact.body"),
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <PageHeader title={t("privacy.title")} back={true} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 py-4 pb-safe flex flex-col gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("privacy.intro")}
        </p>

        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2"
          >
            <div className="flex items-start gap-3">
              {section.icon}
              <p className="text-sm font-medium text-foreground">{section.title}</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-[1.875rem]">
              {section.body}
            </p>
          </div>
        ))}

        <div className="h-4" />
      </div>
    </div>
  );
}
