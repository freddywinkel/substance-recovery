import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";

function isReplitInternalProxy(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes(".picard.replit.dev") || url.includes(".replit.dev");
}

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains. Do not inline the env var,
// leave publishableKey undefined, or replace publishableKeyFromHost.
const configuredClerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const clerkPubKey = configuredClerkPublishableKey
  ? publishableKeyFromHost(
      window.location.hostname,
      configuredClerkPublishableKey,
    )
  : undefined;

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV.
// Filter out Replit internal proxy URLs — they are not accessible from the public internet.
export const clerkProxyUrl = isReplitInternalProxy(import.meta.env.VITE_CLERK_PROXY_URL)
  ? undefined
  : import.meta.env.VITE_CLERK_PROXY_URL;

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's setLocation
// prepends the base — strip it to avoid doubling.
export function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey && import.meta.env.DEV) {
  console.warn(
    "Missing VITE_CLERK_PUBLISHABLE_KEY — auth features will be disabled. The app works fully in offline/signed-out mode.",
  );
}

// Branded appearance for the Substance Recovery sign-in / sign-up pages. The app is dark by
// default; the auth pages render in the dark palette regardless of the in-app
// theme toggle. cssLayerName ensures Tailwind utilities (utilities layer) win
// over Clerk's own styles (clerk layer) without needing !important.
export const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(35 80% 58%)",
    colorForeground: "hsl(0 0% 92%)",
    colorMutedForeground: "hsl(0 0% 52%)",
    colorDanger: "hsl(0 62% 55%)",
    colorBackground: "hsl(20 8% 10%)",
    colorInput: "hsl(20 6% 18%)",
    colorInputForeground: "hsl(0 0% 92%)",
    colorNeutral: "hsl(0 0% 88%)",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[hsl(20_8%_10%)] border border-[hsl(20_6%_18%)] rounded-2xl w-[400px] max-w-full overflow-hidden shadow-2xl",
    card: "shadow-none border-0 bg-transparent rounded-none",
    footer: "shadow-none border-0 bg-transparent rounded-none",
    headerTitle: "text-[hsl(0_0%_92%)]",
    headerSubtitle: "text-[hsl(0_0%_52%)]",
    socialButtonsBlockButton:
      "border-[hsl(20_6%_24%)] bg-[hsl(20_6%_14%)] hover:bg-[hsl(20_6%_18%)]",
    socialButtonsBlockButtonText: "text-[hsl(0_0%_92%)]",
    dividerLine: "bg-[hsl(20_6%_22%)]",
    dividerText: "text-[hsl(0_0%_52%)]",
    formFieldLabel: "text-[hsl(0_0%_82%)]",
    formFieldInput:
      "bg-[hsl(20_6%_18%)] border-[hsl(20_6%_24%)] text-[hsl(0_0%_92%)]",
    formButtonPrimary:
      "bg-[hsl(35_80%_58%)] hover:bg-[hsl(35_80%_52%)] text-[hsl(20_6%_4%)] font-semibold normal-case",
    footerActionText: "text-[hsl(0_0%_52%)]",
    footerActionLink: "text-[hsl(35_80%_64%)] hover:text-[hsl(35_80%_72%)]",
    identityPreviewEditButton: "text-[hsl(35_80%_64%)]",
    formFieldSuccessText: "text-[hsl(160_40%_70%)]",
    alertText: "text-[hsl(0_0%_88%)]",
    otpCodeFieldInput:
      "bg-[hsl(20_6%_18%)] border-[hsl(20_6%_24%)] text-[hsl(0_0%_92%)]",
    logoBox: "justify-center",
    logoImage: "h-10 w-auto",
    main: "gap-4",
  },
};
