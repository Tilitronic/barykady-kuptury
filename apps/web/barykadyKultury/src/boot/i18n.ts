import { defineBoot } from "#q-app";
import { createI18n } from "vue-i18n";

import messages from "@/i18n";

export type MessageLanguages = keyof typeof messages;
// Type-define 'en' as the master schema for the resource
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

export default defineBoot(({ app }) => {
  const i18n = createI18n<{ message: MessageSchema }, MessageLanguages>({
    locale: "en",
    legacy: false,
    messages
  });

  // Set i18n instance on app
  app.use(i18n);
});
