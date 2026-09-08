import React from "react";
import type { EmergencyContact } from "@/db/schema";
import { phoneHref } from "@/lib/registrationSafety";
export function PersonalContactCard({ contact, language }: { contact: EmergencyContact; language: "en" | "nl" }) {
  const nl = language === "nl";
  return <div className="rounded-xl border border-border bg-background p-3 space-y-2">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium break-words">{contact.name}</p><p className="text-xs text-muted-foreground break-words">{contact.relationship}{contact.role ? ` · ${contact.role}` : ""}</p></div>
      <a href={phoneHref(contact.phone)} className="touch-target shrink-0 rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary">{nl ? "Bellen" : "Call"}</a></div>
    <p className="text-xs text-muted-foreground">{contact.availability || (nl ? "Bereikbaarheid nog niet vastgelegd" : "Availability not recorded yet")}</p>
    {(contact.supportNotes || contact.fallback) && <details><summary className="touch-target cursor-pointer text-xs font-medium">{nl ? "Onze afspraken en alternatief" : "Our agreements and alternative"}</summary>
      {contact.supportNotes && <p className="text-xs whitespace-pre-wrap break-words py-2">{contact.supportNotes}</p>}
      {contact.fallback && <p className="text-xs whitespace-pre-wrap break-words py-2">{nl ? "Als contact niet lukt: " : "If unavailable: "}{contact.fallback}</p>}
    </details>}
  </div>;
}
