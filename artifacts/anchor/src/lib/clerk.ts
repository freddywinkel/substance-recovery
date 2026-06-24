import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains. Do not inline the env var,
// leave publishableKey undefined, or replace publishableKeyFromHost.
export const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV.
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace, but wouter's setLocation
// prepends the base — strip it to avoid doubling.
export function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  console.warn(
    "Missing VITE_CLERK_PUBLISHABLE_KEY — auth features will be disabled. The app works fully in offline/signed-out mode.",
  );
}

// Branded appearance for the Anchor sign-in / sign-up pages. The app is dark by
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
    colorForeground: "hsl(210 20% 90%)",
    colorMutedForeground: "hsl(210 12% 60%)",
    colorDanger: "hsl(0 62% 55%)",
    colorBackground: "hsl(222 16% 14%)",
    colorInput: "hsl(222 12% 18%)",
    colorInputForeground: "hsl(210 20% 92%)",
    colorNeutral: "hsl(210 20% 88%)",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-[hsl(222_16%_14%)] border border-[hsl(222_12%_22%)] rounded-2xl w-[400px] max-w-full overflow-hidden shadow-2xl",
    card: "shadow-none border-0 bg-transparent rounded-none",
    footer: "shadow-none border-0 bg-transparent rounded-none",
    headerTitle: "text-[hsl(210_20%_92%)]",
    headerSubtitle: "text-[hsl(210_12%_62%)]",
    socialButtonsBlockButton:
      "border-[hsl(222_12%_28%)] bg-[hsl(222_14%_18%)] hover:bg-[hsl(222_14%_22%)]",
    socialButtonsBlockButtonText: "text-[hsl(210_20%_90%)]",
    dividerLine: "bg-[hsl(222_12%_26%)]",
    dividerText: "text-[hsl(210_12%_60%)]",
    formFieldLabel: "text-[hsl(210_16%_82%)]",
    formFieldInput:
      "bg-[hsl(222_12%_18%)] border-[hsl(222_12%_28%)] text-[hsl(210_20%_92%)]",
    formButtonPrimary:
      "bg-[hsl(35_80%_58%)] hover:bg-[hsl(35_80%_52%)] text-[hsl(222_18%_8%)] font-semibold normal-case",
    footerActionText: "text-[hsl(210_12%_60%)]",
    footerActionLink: "text-[hsl(35_80%_64%)] hover:text-[hsl(35_80%_72%)]",
    identityPreviewEditButton: "text-[hsl(35_80%_64%)]",
    formFieldSuccessText: "text-[hsl(160_40%_70%)]",
    alertText: "text-[hsl(210_20%_88%)]",
    otpCodeFieldInput:
      "bg-[hsl(222_12%_18%)] border-[hsl(222_12%_28%)] text-[hsl(210_20%_92%)]",
    logoBox: "justify-center",
    logoImage: "h-10 w-auto",
    main: "gap-4",
  },
};
