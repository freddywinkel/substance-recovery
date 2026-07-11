import { useStore } from "@/hooks/useStore";
import { useT } from "@/hooks/useTranslation";
import { PageHeader } from "@/components/PageHeader";
import { RegistrationHistory } from "@/components/RegistrationHistory";

export function Registraties() {
  const { loading } = useStore();
  const { t } = useT();

  if (loading) {
    return (
      <div role="status" className="flex items-center justify-center min-h-dvh">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("logs.title")} subtitle={t("logs.subtitle")} />

      <div className="flex-1 overflow-y-auto scroll-smooth-ios px-4 pt-2 flex flex-col gap-3 pb-safe">
        <section className="flex flex-col gap-3" aria-label={t("logs.title")}>
          <RegistrationHistory />
        </section>
      </div>
    </div>
  );
}
