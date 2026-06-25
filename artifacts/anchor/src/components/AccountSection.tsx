import { Show, useUser, useClerk } from "@clerk/react";
import { useSync } from "@/contexts/SyncContext";
import { useT } from "@/hooks/useT";
import { useLocation } from "wouter";
import { Cloud, LogOut, RefreshCw, Check, CloudOff, AlertCircle } from "lucide-react";

export function AccountSection() {
  const { t, language } = useT();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { status: syncStatus, lastSyncedAt, isSignedIn: syncSignedIn, syncNow } = useSync();
  const [, navigate] = useLocation();

  return (
    <section>
      <p className="text-xs text-muted-foreground uppercase tracking-widest px-1 mb-3">{t("settings.section.account")}</p>
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
        <Show when="signed-out">
          <div className="flex items-start gap-3">
            <Cloud size={18} className="text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">{t("settings.account.signedOutTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {t("settings.account.signedOutBody")}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1 leading-relaxed">
                {t("settings.account.localNote")}
              </p>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => navigate("/sign-in")}
              className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {t("settings.account.signIn")}
            </button>
            <button
              onClick={() => navigate("/sign-up")}
              className="flex-1 border border-border rounded-xl py-3 font-medium text-sm text-foreground hover:bg-muted/40 transition-colors touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {t("settings.account.signUp")}
            </button>
          </div>
        </Show>
        <Show when="signed-in">
          <div className="flex items-start gap-3">
            <Cloud size={18} className="text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{t("settings.account.signedInTitle")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-words">
                {t("settings.account.signedInAs")} {user?.primaryEmailAddress?.emailAddress ?? user?.username ?? ""}
              </p>
            </div>
          </div>

          {/* Sync status */}
          <div className="flex items-center justify-between gap-3 bg-background border border-border rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {syncStatus === "syncing" && <RefreshCw size={15} className="text-primary shrink-0 animate-spin" />}
              {syncStatus === "error" && <AlertCircle size={15} className="text-destructive shrink-0" />}
              {syncStatus === "offline" && <CloudOff size={15} className="text-muted-foreground shrink-0" />}
              {(syncStatus === "synced" || syncStatus === "idle") && <Check size={15} className="text-primary shrink-0" />}
              <p className={`text-xs leading-snug truncate ${syncStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                {syncStatus === "syncing" && t("settings.account.syncing")}
                {syncStatus === "error" && t("settings.account.syncError")}
                {syncStatus === "offline" && t("settings.account.syncOffline")}
                {(syncStatus === "synced" || syncStatus === "idle") && (
                  lastSyncedAt
                    ? `${t("settings.account.lastSynced")} ${new Date(lastSyncedAt).toLocaleTimeString(language === "nl" ? "nl-NL" : "en-GB", { hour: "2-digit", minute: "2-digit" })}`
                    : t("settings.account.synced")
                )}
              </p>
            </div>
            <button
              onClick={syncNow}
              disabled={syncStatus === "syncing"}
              className="shrink-0 text-xs font-medium text-primary hover:opacity-80 disabled:opacity-40 transition-opacity touch-target px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
            >
              {t("settings.account.syncNow")}
            </button>
          </div>

          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-3 font-medium text-sm text-foreground hover:bg-muted/40 transition-colors touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <LogOut size={16} />
            {t("settings.account.signOut")}
          </button>
        </Show>
      </div>
    </section>
  );
}
