import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { useT } from "@/hooks/useT";

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-foreground">{t("notfound.title")}</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {t("notfound.body")}
          </p>

          <div className="mt-6">
            <Link href="/" asChild>
              <a className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-95 transition-all touch-target">
                <Home size={16} strokeWidth={2} />
                {t("notfound.home")}
              </a>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
