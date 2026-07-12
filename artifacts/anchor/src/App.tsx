import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ActiveRegistrationProvider } from "@/contexts/ActiveRegistrationContext";
import { RegistrationLauncherProvider } from "@/contexts/RegistrationLauncherContext";
import { useT } from "@/hooks/useTranslation";
import { BottomNav } from "@/components/BottomNav";
import { RegistrationReturnBanner } from "@/components/RegistrationReturnBanner";
import { PWAProvider } from "@/hooks/usePWA";
import { AtmosphericBackground } from "@/components/AtmosphericBackground";
import { ScrollToTop } from "@/components/ScrollToTop";
import { basePath } from "@/lib/basePath";
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
  return (
    <>
      <AtmosphericBackground />
      <ScrollToTop />
      <RegistrationLauncherProvider>
        <div
          className="relative flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-background"
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
    <ActiveRegistrationProvider>
      <AppShell />
    </ActiveRegistrationProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <PWAProvider>
        <WouterRouter base={basePath}>
          <OfflineAppShell />
        </WouterRouter>
      </PWAProvider>
    </LanguageProvider>
  );
}
