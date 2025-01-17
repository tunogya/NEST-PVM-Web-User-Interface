import { i18n } from "@lingui/core";
import messagesEn from "./en/messages.js"
import messagesJa from "./ja/messages.js"
import messagesKo from "./ko/messages.js"
import messagesPt from "./pt/messages.js"
import messagesRu from "./ru/messages.js"

export const defaultLocale = "en";
i18n.load('en', messagesEn)
i18n.load('ja', messagesJa)
i18n.load('ko', messagesKo)
i18n.load('pt', messagesPt)
i18n.load('ru', messagesRu)
/**
 * We do a dynamic import of just the catalog that we need
 * @param locale any locale string
 */
export async function dynamicActivate(locale: string) {
  const { messages } = await import(`./${locale}/messages`)
  i18n.loadAndActivate({ locale, messages });
}
