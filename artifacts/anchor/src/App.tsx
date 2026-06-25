import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { useEffect, useRef } from "react";
import { ClerkProvider, useClerk } from "@clerk/react";
import { nlNL, enUS } from "@clerk/localizations";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { ActiveRegistrationProvider } from "@/contexts/ActiveRegistrationContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { useT } from "@/hooks/useT";
import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RegistrationReturnBanner } from "@/components/RegistrationReturnBanner";
import { usePWA } from "@/hooks/usePWA";
import { queryClient } from "@/lib/queryClient";
import { ClerkAvailableContext } from "@/lib/clerk-safe";
import { AtmosphericBackground } from "@/components/AtmosphericBackground";
import { ScrollToTop } from "@/hooks/useScrollToTop";
import {
  clerkPubKey,
  clerkProxyUrl,
  clerkAppearance,
  basePath,
  stripBase,
} from "@/lib/clerk";
import { Home } from "@/pages/Home";
import { CrisisNow } from "@/pages/CrisisNow";
import { Tools } from "@/pages/Tools";
import { Journal } from "@/pages/Journal";
import { JournalNewEntry } from "@/pages/JournalNewEntry";
import { Registraties } from "@/pages/Registraties";
import { Insights } from "@/pages/Insights";
import { Settings } from "@/pages/Settings";
import { CravingTracker } from "@/pages/CravingTracker";
import { RelapseLog } from "@/pages/RelapseLog";
import { AnxietyTracker } from "@/pages/AnxietyTracker";
import { BoredomTracker } from "@/pages/BoredomTracker";
import { TrekTracker } from "@/pages/TrekTracker";
import { DelayScreen } from "@/pages/DelayScreen";
import { SignInPage, SignUpPage } from "@/pages/AuthPages";
import { BoxBreathing } from "@/tools/BoxBreathing";
import { Grounding54321 } from "@/tools/Grounding54321";
import { UrgeSurfing } from "@/tools/UrgeSurfing";
import { PlayTheTape } from "@/tools/PlayTheTape";
import { ColdWaterReset } from "@/tools/ColdWaterReset";
import { SelfCompassion } from "@/tools/SelfCompassion";
import { Distraction } from "@/tools/Distraction";

function NotFound() {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center bg-background">
      <p className="text-4xl mb-4">🌊</p>
      <h1 className="text-xl font-semibold text-foreground mb-2">{t("notfound.title")}</h1>
      <p className="text-muted-foreground text-sm">{t("notfound.body")}</p>
      <a href="/" className="mt-6 text-primary text-sm font-medium">{t("notfound.home")}</a>
    </div>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/help" component={CrisisNow} />
      <Route path="/trek" component={TrekTracker} />
      <Route path="/craving" component={CravingTracker} />
      <Route path="/relapse" component={RelapseLog} />
      <Route path="/tools" component={Tools} />
      <Route path="/tools/breathing" component={BoxBreathing} />
      <Route path="/tools/grounding" component={Grounding54321} />
      <Route path="/tools/urge-surfing" component={UrgeSurfing} />
      <Route path="/tools/tape" component={PlayTheTape} />
      <Route path="/tools/cold-water" component={ColdWaterReset} />
      <Route path="/tools/self-compassion" component={SelfCompassion} />
      <Route path="/tools/distraction" component={Distraction} />
      <Route path="/anxiety" component={AnxietyTracker} />
      <Route path="/boredom" component={BoredomTracker} />
      <Route path="/delay" component={DelayScreen} />
      <Route path="/registraties" component={Registraties} />
      <Route path="/journal" component={Journal} />
      <Route path="/journal/new" component={JournalNewEntry} />
      <Route path="/insights" component={Insights} />
      <Route path="/settings" component={Settings} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Invalidate the react-query cache when the signed-in user changes so one
// account's cached data never leaks into another session.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

import { SOSButton } from "@/components/SOSButton";

function AppShell() {
  const { isOffline } = usePWA();

  return (
    <>
      <AtmosphericBackground />
      <ScrollToTop />
      <OfflineBanner isOffline={isOffline} />
      <div
        className="relative flex flex-col"
        style={{ minHeight: "100dvh" }}
      >
        <AppRoutes />
        <RegistrationReturnBanner />
        <BottomNav />
      </div>
      <SOSButton />
      <Toaster />
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  if (!clerkPubKey) return null;

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={language === "nl" ? nlNL : enUS}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <SyncProvider>
          <ActiveRegistrationProvider>
            <AppShell />
          </ActiveRegistrationProvider>
        </SyncProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function NonClerkAppShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <ActiveRegistrationProvider>
          <AppShell />
        </ActiveRegistrationProvider>
      </SyncProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <WouterRouter base={basePath}>
        {clerkPubKey ? (
          <ClerkAvailableContext.Provider value={true}>
            <ClerkProviderWithRoutes />
          </ClerkAvailableContext.Provider>
        ) : (
          <ClerkAvailableContext.Provider value={false}>
            <NonClerkAppShell />
          </ClerkAvailableContext.Provider>
        )}
      </WouterRouter>
    </LanguageProvider>
  );
}
