import { Link } from "wouter";
import { Eye, Heart, Phone, Sprout } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useT } from "@/hooks/useTranslation";
import { SELF_CRITICISM_COPY } from "@/lib/selfCriticismCopy";

export function SelfCriticism() {
  const { language } = useT();
  const copy = SELF_CRITICISM_COPY[language];
  const options = [
    {
      to: "/tools/grounding",
      icon: Eye,
      title: copy.grounding,
      description: copy.groundingBody,
    },
    {
      to: "/tools/self-compassion/brief",
      icon: Heart,
      title: copy.kinderWords,
      description: copy.kinderWordsBody,
    },
    {
      to: "/growth?favourites=1",
      icon: Sprout,
      title: copy.growth,
      description: copy.growthBody,
    },
    {
      to: "/help",
      icon: Phone,
      title: copy.contact,
      description: copy.contactBody,
    },
  ];

  // This route offers choices only. Opening it does not create a registration
  // or infer anything from the user's notes or previously saved moments.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={copy.title} back />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-safe">
        <div className="mx-auto flex max-w-xl flex-col gap-4 pb-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {copy.intro}
          </p>
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center rounded-2xl border border-border px-4 py-3 text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {copy.stop}
          </Link>
          <section
            aria-labelledby="self-criticism-acknowledge"
            className="rounded-3xl border border-border bg-card p-5"
          >
            <h2 id="self-criticism-acknowledge" className="font-semibold">
              {copy.acknowledge}
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              {copy.acknowledgeBody}
            </p>
          </section>
          <section aria-labelledby="self-criticism-choose">
            <h2 id="self-criticism-choose" className="font-semibold">
              {copy.choose}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {copy.choiceHint}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {options.map(({ to, icon: Icon, title, description }) => (
                <Link
                  key={to}
                  href={to}
                  className="flex min-h-12 items-start gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Icon
                    size={21}
                    className="mt-0.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center rounded-2xl border border-border px-4 py-3 text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {copy.stop}
          </Link>
        </div>
      </div>
    </div>
  );
}
