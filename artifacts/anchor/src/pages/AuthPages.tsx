import { SignIn, SignUp } from "@clerk/react";
import { basePath } from "@/lib/clerk";
import { useClerkAvailable } from "@/lib/clerk-safe";
import { useT } from "@/hooks/useTranslation";
import { CloudOff, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

function AuthFallback() {
  const { t } = useT();
  const [, navigate] = useLocation();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 text-center">
        <CloudOff size={32} className="text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold text-foreground">{t("account.login")}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("account.description")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("account.offlineNotice")}
        </p>
        <button
          onClick={() => navigate("/settings")}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm hover:opacity-90 active:scale-95 transition-all touch-target"
        >
          <ArrowLeft size={16} />
          {t("common.back")}
        </button>
      </div>
    </div>
  );
}

export function SignInPage() {
  const clerkAvailable = useClerkAvailable();
  if (!clerkAvailable) return <AuthFallback />;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

export function SignUpPage() {
  const clerkAvailable = useClerkAvailable();
  if (!clerkAvailable) return <AuthFallback />;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}
