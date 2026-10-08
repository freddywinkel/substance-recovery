import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ActiveRegistrationProvider } from "@/contexts/ActiveRegistrationContext";
import { RegistrationLauncherProvider } from "@/contexts/RegistrationLauncherContext";
import { RecoveryFeaturesProvider } from "@/contexts/RecoveryFeaturesContext";
import { useT } from "@/hooks/useTranslation";
import { BottomNav } from "@/components/BottomNav";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { RegistrationReturnBanner } from "@/components/RegistrationReturnBanner";
import { RegistrationStorageBanner } from "@/components/RegistrationStorageBanner";
import { DataIntegrityBanner } from "@/components/DataIntegrityBanner";
import { PWAProvider } from "@/hooks/usePWA";
import { AtmosphericBackground } from "@/components/AtmosphericBackground";
import { ScrollToTop } from "@/components/ScrollToTop";
import { basePath } from "@/lib/basePath";
import { HelpAccess } from "@/components/HelpAccess";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { DatabaseGate } from "@/components/DatabaseGate";
import { ActionCard } from "@/pages/ActionCard";
import { Home } from "@/pages/Home";
import { CrisisNow } from "@/pages/CrisisNow";
const Tools = lazy(() =>
  import("@/pages/Tools").then((module) => ({ default: module.Tools })),
);
const Journal = lazy(() =>
  import("@/pages/Journal").then((module) => ({ default: module.Journal })),
);
const JournalNewEntry = lazy(() =>
  import("@/pages/JournalNewEntry").then((module) => ({
    default: module.JournalNewEntry,
  })),
);
const Registraties = lazy(() =>
  import("@/pages/Registraties").then((module) => ({
    default: module.Registraties,
  })),
);
const Insights = lazy(() =>
  import("@/pages/Insights").then((module) => ({ default: module.Insights })),
);
const Settings = lazy(() =>
  import("@/pages/Settings").then((module) => ({ default: module.Settings })),
);
const More = lazy(() =>
  import("@/pages/More").then((module) => ({ default: module.More })),
);
const QuickRegistration = lazy(() =>
  import("@/pages/QuickRegistration").then((module) => ({
    default: module.QuickRegistration,
  })),
);
const RecoveryPlan = lazy(() =>
  import("@/pages/RecoveryPlan").then((module) => ({
    default: module.RecoveryPlan,
  })),
);
const HomeCustomization = lazy(() =>
  import("@/pages/HomeCustomization").then((module) => ({
    default: module.HomeCustomization,
  })),
);
const RecoveryActions = lazy(() =>
  import("@/pages/RecoveryActions").then((module) => ({
    default: module.RecoveryActions,
  })),
);
const WeeklyReview = lazy(() =>
  import("@/pages/WeeklyReview").then((module) => ({
    default: module.WeeklyReview,
  })),
);
const MyGrowth = lazy(() => import("@/pages/MyGrowth").then(module => ({ default: module.MyGrowth })));
const GrowthMoment = lazy(() => import("@/pages/GrowthMoment").then(module => ({ default: module.GrowthMoment })));
const BriefSelfCompassion = lazy(() => import("@/tools/BriefSelfCompassion").then(module => ({ default: module.BriefSelfCompassion })));
const ReportBuilder = lazy(() =>
  import("@/pages/ReportBuilder").then((module) => ({
    default: module.ReportBuilder,
  })),
);
const CravingTracker = lazy(() =>
  import("@/pages/CravingTracker").then((module) => ({
    default: module.CravingTracker,
  })),
);
const RelapseLog = lazy(() =>
  import("@/pages/RelapseLog").then((module) => ({
    default: module.RelapseLog,
  })),
);
const AnxietyTracker = lazy(() =>
  import("@/pages/AnxietyTracker").then((module) => ({
    default: module.AnxietyTracker,
  })),
);
const BoredomTracker = lazy(() =>
  import("@/pages/BoredomTracker").then((module) => ({
    default: module.BoredomTracker,
  })),
);
const TrekTracker = lazy(() =>
  import("@/pages/TrekTracker").then((module) => ({
    default: module.TrekTracker,
  })),
);
const DelayScreen = lazy(() =>
  import("@/pages/DelayScreen").then((module) => ({
    default: module.DelayScreen,
  })),
);
const PrivacyPolicy = lazy(() =>
  import("@/pages/PrivacyPolicy").then((module) => ({
    default: module.PrivacyPolicy,
  })),
);
const BoxBreathing = lazy(() =>
  import("@/tools/BoxBreathing").then((module) => ({
    default: module.BoxBreathing,
  })),
);
const Grounding54321 = lazy(() =>
  import("@/tools/Grounding54321").then((module) => ({
    default: module.Grounding54321,
  })),
);
const UrgeSurfing = lazy(() =>
  import("@/tools/UrgeSurfing").then((module) => ({
    default: module.UrgeSurfing,
  })),
);
const PlayTheTape = lazy(() =>
  import("@/tools/PlayTheTape").then((module) => ({
    default: module.PlayTheTape,
  })),
);
const ColdWaterReset = lazy(() =>
  import("@/tools/ColdWaterReset").then((module) => ({
    default: module.ColdWaterReset,
  })),
);
const SelfCompassion = lazy(() =>
  import("@/tools/SelfCompassion").then((module) => ({
    default: module.SelfCompassion,
  })),
);
const Distraction = lazy(() =>
  import("@/tools/Distraction").then((module) => ({
    default: module.Distraction,
  })),
);

function NotFound() {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center bg-background">
      <p className="text-4xl mb-4">🌊</p>
      <h1 className="text-xl font-semibold text-foreground mb-2">
        {t("notfound.title")}
      </h1>
      <p className="text-muted-foreground text-sm">{t("notfound.body")}</p>
      <a
        href={`${basePath}/`}
        className="mt-6 text-primary text-sm font-medium"
      >
        {t("notfound.home")}
      </a>
    </div>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/help" component={CrisisNow} />
      <Route path="/action-card" component={ActionCard} />
      <Route path="/quick" component={QuickRegistration} />
      <Route path="/recovery-plan" component={RecoveryPlan} />
      <Route path="/home-customization" component={HomeCustomization} />
      <Route path="/actions" component={RecoveryActions} />
      <Route path="/growth" component={MyGrowth} />
      <Route path="/moments/new" component={GrowthMoment} />
      <Route path="/moments/:id/edit" component={GrowthMoment} />
      <Route path="/weekly-review" component={WeeklyReview} />
      <Route path="/report" component={ReportBuilder} />
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
      <Route path="/tools/self-compassion/brief" component={BriefSelfCompassion} />
      <Route path="/tools/distraction" component={Distraction} />
      <Route path="/anxiety" component={AnxietyTracker} />
      <Route path="/boredom" component={BoredomTracker} />
      <Route path="/delay" component={DelayScreen} />
      <Route path="/registraties" component={Registraties} />
      <Route path="/journal" component={Journal} />
      <Route path="/journal/new" component={JournalNewEntry} />
      <Route path="/insights" component={Insights} />
      <Route path="/settings" component={Settings} />
      <Route path="/more" component={More} />
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
        <div className="relative flex h-dvh min-h-dvh w-full max-w-full flex-col overflow-hidden bg-background">
          <HelpAccess />
          <main className="app-main min-h-0 flex-1 overflow-hidden">
            <DatabaseGate><RouteErrorBoundary>
              <Suspense
                fallback={
                  <div role="status" className="p-5 text-sm">
                    Anchor…
                  </div>
                }
              >
                <AppRoutes />
              </Suspense>
            </RouteErrorBoundary></DatabaseGate>
          </main>
          <DataIntegrityBanner />
          <RegistrationStorageBanner />
          <RegistrationReturnBanner />
          <BottomNav />
        </div>
      </RegistrationLauncherProvider>
      <PwaUpdatePrompt />
      <Toaster />
    </>
  );
}

function OfflineAppShell() {
  return (
    <RecoveryFeaturesProvider>
      <ActiveRegistrationProvider>
        <AppShell />
      </ActiveRegistrationProvider>
    </RecoveryFeaturesProvider>
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
