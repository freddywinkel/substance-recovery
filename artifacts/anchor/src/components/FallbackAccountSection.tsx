import { useState } from "react";
import { useT } from "@/hooks/useT";
import { Cloud, CloudOff, LogIn, X } from "lucide-react";

export function FallbackAccountSection() {
  const { t } = useT();
  const [showModal, setShowModal] = useState(false);

  return (
    <section>
      <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">
        {t("account.title")}
      </p>
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <CloudOff size={18} className="text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">{t("account.login")}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {t("account.description")}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
              {t("account.localNote")}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <LogIn size={16} />
          {t("account.login")}
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm px-4 pb-8">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{t("account.login")}</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg"
                aria-label={t("common.cancel")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex items-start gap-3">
              <CloudOff size={20} className="text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-foreground leading-relaxed">
                  {t("account.description")}
                </p>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  {t("account.localNote")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {t("common.done")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
