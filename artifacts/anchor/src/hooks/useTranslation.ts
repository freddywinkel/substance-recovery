import { useLanguage } from "@/contexts/LanguageContext";
import { getTranslation, getOptionTranslation } from "@/lib/translations";

export function useT() {
  const { language } = useLanguage();

  const t = (key: string): string => getTranslation(language, key);

  const tOpt = (str: string): string => getOptionTranslation(language, str);

  return { t, tOpt, language };
}
