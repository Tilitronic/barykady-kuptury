import type { MessageSchema } from "../en";

/**
 * Ukrainian messages. Typed against the English master schema so the key set can
 * never drift (T-009 catalogue parity).
 * Only verified organization facts belong here — no placeholder contact details.
 */
const uk: MessageSchema = {
  app: {
    name: "Barykady Kultury"
  },
  common: {
    skipToContent: "Перейти до вмісту"
  },
  nav: {
    language: "Мова"
  },
  home: {
    title: "Barykady Kultury",
    description: "Офіційний сайт організації Barykady Kultury.",
    placeholder: "Вміст сайту готується."
  },
  projects: {
    title: "Проєкти",
    description: "Проєкти організації Barykady Kultury.",
    placeholder: "Проєкти готуються."
  },
  notFound: {
    title: "Сторінку не знайдено",
    description: "Запитану сторінку не знайдено.",
    message: "Запитану сторінку не знайдено."
  }
};

export default uk;
