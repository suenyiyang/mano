import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-us.json";
import zhCN from "./locales/zh-cn.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "en-US": { translation: enUS },
      "zh-CN": { translation: zhCN },
    },
    fallbackLng: "en-US",
    supportedLngs: ["en-US", "zh-CN"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "mano_language",
      caches: ["localStorage"],
    },
  });

export default i18n;
