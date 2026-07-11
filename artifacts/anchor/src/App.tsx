import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ActiveRegistrationProvider } from "@/contexts/ActiveRegistrationContext";
import { RegistrationLauncherProvider } from "@/contexts/RegistrationLauncherContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { useT } from "@/hooks/useTranslation";
import { BottomNav } from "@/components/BottomNav";
import { OfflineBanner } from "@/components/OfflineBanner";
import { RegistrationReturnBanner } from "@/components/RegistrationReturnBanner";
import { usePWA } from "@/hooks/usePWA";
import { queryClient } from "@/lib/queryClient";
import { AtmosphericBackground } from "@/components/AtmosphericBackground";
import { ScrollToTop } from "@/components/ScrollToTop";
import { basePath } from "@/lib/clerk";
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
import { PrivacyPolicy } from "@/pages/PrivacyPolicy";
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
      <a href={`${basePath}/`} className="mt-6 text-primary text-sm font-medium">{t("notfound.home")}</a>
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
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const { isOffline } = usePWA();

  return (
    <>
      <AtmosphericBackground />
      <ScrollToTop />
      <OfflineBanner isOffline={isOffline} />
      <RegistrationLauncherProvider>
        <div
          className="relative flex h-dvh min-h-dvh flex-col overflow-hidden"
        >
          <main className="app-main min-h-0 flex-1 overflow-hidden">
            <AppRoutes />
          </main>
          <RegistrationReturnBanner />
          <BottomNav />
        </div>
      </RegistrationLauncherProvider>
      <Toaster />
    </>
  );
}

function OfflineAppShell() {
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
        <OfflineAppShell />
      </WouterRouter>
    </LanguageProvider>
  );
}
