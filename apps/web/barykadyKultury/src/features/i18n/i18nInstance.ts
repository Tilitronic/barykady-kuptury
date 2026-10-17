import { createI18n } from "vue-i18n";

import messages from "@/i18n";

import { DEFAULT_LOCALE } from "./locales";

export type MessageLanguages = keyof typeof messages;
/** Type-define 'en' as the master schema for the resource. */
export type MessageSchema = (typeof messages)["en"];

// See https://vue-i18n.intlify.dev/guide/advanced/typescript.html#global-resource-schema-type-definition
declare module "vue-i18n" {
  // define the locale messages schema
  export interface DefineLocaleMessage extends MessageSchema {}

  // define the datetime format schema
  export interface DefineDateTimeFormat {}

  // define the number format schema
  export interface DefineNumberFormat {}
}

/**
 * Single application-wide i18n instance.
 *
 * Created here rather than inside the boot file so the router guard can set the
 * active locale on the same instance the components read from. Keeping one
 * instance is what makes switching languages update the UI and the document
 * metadata atomically.
 */
export const i18n = createI18n<
  { message: MessageSchema },
  MessageLanguages,
  false
>({
  locale: DEFAULT_LOCALE,
  legacy: false,
  messages
});
