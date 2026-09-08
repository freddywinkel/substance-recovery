import React from "react";
import type { CrisisService } from "@/db/schema";
import { careFallback, careRoleLabel, resolveCareContact } from "@/lib/careDirectory";
import { phoneHref } from "@/lib/registrationSafety";
export function CareContactCard({ service, language }: { service: CrisisService; language: "en" | "nl" }) {
  const info = resolveCareContact(service, language);
  const nl = language === "nl";
  return <section className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-label={nl ? "Opgeslagen zorg- of steuncontact" : "Saved care or support contact"}>
    <h2 className="font-semibold text-sm">{service.name}</h2>
    <p className="text-xs font-medium text-primary">{careRoleLabel(info.role, language)}</p>
    <p className="text-sm text-muted-foreground">{info.eligibility}</p>
    <p className="text-xs text-muted-foreground">{info.availability}</p>
    {info.changedNumber && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{nl ? "Dit opgeslagen nummer komt niet overeen met de actuele bron. Controleer het via de officiële website en kies het contact opnieuw in Instellingen." : "This saved number does not match the current source. Check the official website and select the contact again in Settings."} ({service.number})</p>}
    {info.publicDirect && service.number && <a className="touch-target inline-flex items-center rounded-xl border border-primary/30 px-4 py-3 text-sm font-semibold text-primary" href={phoneHref(service.number)}>{nl ? "Bel dit contact" : "Call this contact"} · {service.number}</a>}
    {!info.publicDirect && !info.changedNumber && <p className="text-sm">{nl ? "Als cliënt: neem contact op met je huisarts of eigen behandelaar." : "As a client: contact your GP or own care professional."}</p>}
    <p className="text-xs text-muted-foreground">{careFallback(language)}</p>
    {info.sourceUrl && <a href={info.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline touch-target inline-flex items-center">{nl ? "Officiële informatie en bereikbaarheid" : "Official information and availability"}{info.checkedAt ? ` · ${info.checkedAt}` : ""}</a>}
  </section>;
}
