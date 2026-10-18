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
  brand: {
    logoLabel: "Barykady Kultury"
  },
  common: {
    skipToContent: "Перейти до вмісту"
  },
  nav: {
    language: "Мова",
    openMenu: "Відкрити меню навігації",
    closeMenu: "Закрити меню навігації",
    mainNav: "Головна навігація",
    contact: "Контакти",
    about: "Про нас",
    support: "Підтримайте нас",
    projects: "Проєкти",
    events: "Події",
    publications: "Публікації",
    aboutOrg: "Організація",
    team: "Команда",
    documents: "Документи"
  },
  footer: {
    nav: "Навігація підвалу",
    privacyPolicy: "Політика конфіденційності",
    socialNav: "Соціальні мережі"
  },
  theme: {
    toggleLabel: "Перемкнути темну тему"
  },
  home: {
    title: "Barykady Kultury",
    description: "Офіційний сайт організації Barykady Kultury.",
    placeholder: "Вміст сайту готується."
  },
  contact: {
    title: "Контакти",
    description: "Контактна інформація Barykady Kultury.",
    notConfigured: "Контактні дані ще не опубліковано.",
    guidance:
      "Тим часом ви можете дізнатися більше про нас або знайти способи підтримки:",
    emailSubject: "Повідомлення із сайту",
    fields: {
      email: "Електронна пошта",
      phone: "Телефон",
      address: "Адреса",
      officeHours: "Години роботи"
    }
  },
  about: {
    title: "Про нас",
    description: "Про організацію Barykady Kultury.",
    placeholder: "Інформація про нас готується."
  },
  aboutTeam: {
    title: "Команда",
    description: "Команда Barykady Kultury.",
    empty: "Наразі немає опублікованих членів команди."
  },
  aboutDocuments: {
    title: "Документи",
    description: "Організаційні документи Barykady Kultury.",
    placeholder: "Документи готуються.",
    empty: "Наразі немає доступних документів.",
    reader: {
      back: "Назад до документів",
      languageLabel: "Мова документа",
      notFound: "Цей документ недоступний.",
      unavailable: "Цей документ недоступний обраною мовою."
    },
    types: {
      regulations: "Регламент",
      statute: "Статут",
      report: "Звіт"
    }
  },
  support: {
    title: "Підтримайте нас",
    description: "Підтримайте організацію Barykady Kultury.",
    intro: "Ви можете підтримати нашу діяльність зазначеними способами.",
    empty: "Способи підтримки організації готуються. Загляньте до нас пізніше.",
    noPayment:
      "Ми не обробляємо карткові платежі на цьому сайті. Підтримку надають безпосередньо на сторінці перевіреного напрямку або банківським переказом.",
    actions: {
      donation: "Підтримайте нас донатом",
      volunteering: "Долучитися до волонтерства"
    },
    bank: {
      heading: "Банківський переказ",
      accountNumber: "Номер рахунку",
      recipient: "Одержувач",
      paymentTitle: "Призначення платежу"
    }
  },
  events: {
    title: "Події",
    description: "Майбутні події, організовані Barykady Kultury.",
    placeholder: "Події готуються."
  },
  publications: {
    title: "Публікації",
    description: "Публікації Barykady Kultury.",
    empty: "Наразі немає доступних публікацій.",
    detail: {
      back: "Назад до публікацій",
      filesHeading: "Доступні файли"
    },
    availability: {
      download: "Завантаження",
      online: "Онлайн"
    },
    external: "Відкрити онлайн"
  },
  projects: {
    title: "Проєкти",
    description: "Проєкти організації Barykady Kultury.",
    empty: "Наразі немає доступних проєктів.",
    detail: {
      back: "Назад до проєктів"
    },
    status: {
      published: "Опубліковано",
      draft: "Чернетка",
      archived: "Заархівовано"
    }
  },
  notFound: {
    title: "Сторінку не знайдено",
    description: "Запитану сторінку не знайдено.",
    message: "Запитану сторінку не знайдено."
  },
  content: {
    loading: "Завантаження…",
    empty: "Ця сторінка недоступна.",
    unavailable: "Цей вміст тимчасово недоступний.",
    fallbackNote: "Цей вміст доступний лише {language} мовою.",
    fallbackLanguage: "англійською",
    opensInNewTab: "відкривається в новій вкладці"
  }
};

export default uk;
