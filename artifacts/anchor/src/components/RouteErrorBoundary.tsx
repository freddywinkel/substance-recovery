import { Component, type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

class PageBoundary extends Component<
  { children: ReactNode; nl: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" className="h-full overflow-y-auto p-5">
        <h1 className="text-lg font-semibold">
          {this.props.nl
            ? "Dit scherm kon niet worden geopend"
            : "This screen could not be opened"}
        </h1>
        <p className="mt-3 text-sm">
          {this.props.nl
            ? "Je opgeslagen gegevens zijn niet gewist. Maak zo nodig verbinding en laad de app opnieuw. Hulp blijft bereikbaar."
            : "Your saved data has not been erased. Connect if needed and reload the app. Help remains available."}
        </p>
        <button
          className="mt-4 min-h-11 rounded-xl border border-border px-4 text-sm"
          onClick={() => window.location.reload()}
        >
          {this.props.nl ? "App opnieuw laden" : "Reload app"}
        </button>
        <Link
          href="/help"
          className="ml-4 inline-flex min-h-11 items-center text-primary underline"
        >
          {this.props.nl ? "Nu hulp" : "Help now"}
        </Link>
        <a href="tel:112" className="mt-4 flex min-h-11 items-center text-sm underline">{this.props.nl ? "Direct gevaar: bel 112" : "Immediate danger: call 112"}</a>
      </section>
    );
  }
}

export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { language } = useLanguage();
  return (
    <PageBoundary key={location} nl={language === "nl"}>
      {children}
    </PageBoundary>
  );
}
