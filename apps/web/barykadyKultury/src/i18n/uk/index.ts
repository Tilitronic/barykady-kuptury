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
  /** Зміст об’єднаних сторінок (T-039, D-25). */
  toc: {
    onThisPage: "На цій сторінці"
  },
  /** Пошук у шапці (T-039, D-26). */
  search: {
    trigger: "Пошук по сайту",
    dialogTitle: "Пошук по сайту",
    inputLabel: "Пошук",
    placeholder: "Шукайте сторінки, проєкти, публікації…",
    close: "Закрити пошук",
    hint: "Введіть принаймні два символи. Результати навігації з’являються миттєво.",
    navSection: "Навігація",
    contentSection: "Вміст",
    loading: "Пошук…",
    noContent: "Немає результатів вмісту.",
    errorContent: "Результати контенту недоступні.",
    errorEvents: "Результати подій недоступні.",
    retry: "Спробувати ще раз",
    counts: "Результати: навігація {navCount}, вміст {contentCount}",
    filtersLabel: "Фільтрувати результати",
    filters: {
      all: "Усі",
      pages: "Сторінки",
      projects: "Проєкти",
      publications: "Публікації",
      documents: "Документи",
      team: "Команда",
      events: "Події"
    },
    navKinds: {
      page: "Сторінка",
      section: "Розділ"
    },
    contentKinds: {
      page: "Сторінка",
      project: "Проєкт",
      publication: "Публікація",
      document: "Документ",
      team: "Учасник команди",
      event: "Подія"
    },
    /** Тексти реєстру навігації (огляд T-039: індекс структурний). */
    navEntries: {
      home: {
        title: "Головна",
        description: "Головна сторінка та огляд організації"
      },
      about: {
        title: "Про нас",
        description: "Місія, історія, цінності, цілі, команда та документи"
      },
      projects: {
        title: "Проєкти",
        description: "Усі проєкти, спочатку вибрані"
      },
      publications: {
        title: "Публікації",
        description: "Звіти та матеріали за роками"
      },
      events: { title: "Події", description: "Майбутні події та календар" },
      support: {
        title: "Підтримайте нас",
        description: "Способи підтримати асоціацію"
      },
      contact: { title: "Контакти", description: "Контактні дані асоціації" },
      "about-mission": {
        title: "Місія",
        description: "Розділ місії на сторінці «Про нас»"
      },
      "about-history": {
        title: "Історія",
        description: "Розділ історії на сторінці «Про нас»"
      },
      "about-values": {
        title: "Цінності",
        description: "Розділ цінностей на сторінці «Про нас»"
      },
      "about-aims": {
        title: "Цілі",
        description: "Розділ цілів на сторінці «Про нас»"
      },
      "about-team": {
        title: "Команда",
        description: "Учасники команди на сторінці «Про нас»"
      },
      "about-documents": {
        title: "Документи",
        description: "Регламенти, звіти та офіційні файли"
      },
      "projects-featured": {
        title: "Вибрані",
        description: "Розділ вибраних проєктів на сторінці «Проєкти»"
      },
      "projects-all": {
        title: "Усі проєкти",
        description: "Усі опубліковані проєкти на сторінці «Проєкти»"
      },
      "events-upcoming": {
        title: "Майбутні",
        description: "Розділ майбутніх подій на сторінці «Події»"
      },
      "events-past": {
        title: "Минулі",
        description: "Розділ минулих подій на сторінці «Події»"
      },
      "events-calendar": {
        title: "Календар",
        description: "Інформація про календар на сторінці «Події»"
      },
      "home-mission": {
        title: "Наша місія",
        description: "Розділ місії на головній сторінці"
      },
      "home-upcoming": {
        title: "Майбутні події",
        description: "Майбутні події на головній сторінці"
      },
      "home-featured": {
        title: "Вибрані проєкти",
        description: "Вибрані проєкти на головній сторінці"
      },
      "home-explore": {
        title: "Досліджуйте",
        description: "Контакти, підтримка та інші посилання"
      },
      year: { description: "Публікації за {year} рік" }
    }
  },
  /** Єдиний читач довгих текстів (T-040). */
  reader: {
    retry: "Спробувати ще раз",
    language: {
      label: "Мова тексту"
    },
    toc: {
      label: "Зміст",
      show: "Показати зміст",
      hide: "Сховати зміст"
    },
    controls: {
      heading: "Налаштування читання",
      textSize: "Розмір тексту",
      /* Крок 0 — базові 16 px; мітки починаються зі «Звичайний». */
      sizes: {
        "0": "Звичайний",
        "1": "Великий",
        "2": "Дуже великий",
        "3": "Максимальний"
      },
      spacingValues: {
        "0": "Стандартний",
        "1": "Просторіший",
        "2": "Просторий",
        "3": "Широкий"
      },
      measure: "Ширина рядка",
      measureValues: {
        narrow: "Вузька",
        medium: "Середня",
        wide: "Широка"
      },
      lineSpacing: "Міжрядковий інтервал",
      paragraphSpacing: "Інтервал між абзацами",
      decrease: "Зменшити",
      increase: "Збільшити",
      reset: "Скинути налаштування",
      resetDone: "Налаштування читання скинуто до типових."
    },
    states: {
      empty: "Цей текст недоступний.",
      unsupported: "Цей текст ще недоступний у версії для читання.",
      unsupportedDownload: " Оригінальний файл можна завантажити нижче."
    }
  },
  nav: {
    language: "Мова",
    changeLanguage: "Змінити мову",
    openMenu: "Відкрити меню навігації",
    closeMenu: "Закрити меню навігації",
    mainNav: "Головна навігація",
    contact: "Контакти",
    about: "Про нас",
    support: "Підтримайте нас",
    projects: "Проєкти",
    events: "Події",
    publications: "Публікації"
  },
  footer: {
    nav: "Навігація підвалу",
    privacyPolicy: "Політика конфіденційності",
    socialNav: "Соціальні мережі"
  },
  theme: {
    darkMode: "Темний режим"
  },
  home: {
    title: "Barykady Kultury",
    description: "Офіційний сайт організації Barykady Kultury.",
    sections: {
      mission: "Наша місія",
      events: "Найближчі події",
      projects: "Вибрані проєкти",
      explore: "Досліджуйте"
    },
    allEvents: "Усі події",
    allProjects: "Усі проєкти",
    eventsEmpty: "Наразі майбутніх подій немає.",
    missionEmpty: "Готуємо розповідь про нас. Завітайте пізніше."
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
    upcoming: "Майбутні",
    past: "Минулі",
    calendar: "Календар",
    pastEmpty:
      "Минулі події тут ще не публікуються — стрічка календаря містить лише майбутні події.",
    calendarNote:
      "Цей список публікується з календаря подій організації. Маєте питання щодо події?",
    empty: "Наразі майбутніх подій немає. Загляньте до нас пізніше.",
    calendarUnavailable: "Календар подій тимчасово недоступний.",
    retry: "Спробувати ще раз",
    contactFallback: "Зв'яжіться з нами щодо подій",
    loaded: "Майбутні події: {count}.",
    languageNote: "Подробиці події надає організатор оригінальною мовою.",
    allDay: "Цілоденна",
    register: "Зареєструватися",
    registerFor: "на подію {title}",
    rangeTo: "до",
    projectLabel: "Пов'язаний проєкт:"
  },
  publications: {
    title: "Публікації",
    description: "Публікації Barykady Kultury.",
    empty: "Наразі немає доступних публікацій.",
    undated: "Без дати",
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
    featured: "Виділені",
    all: "Усі проєкти",
    detail: {
      back: "Назад до проєктів"
    },
    status: {
      published: "Опубліковано",
      draft: "Чернетка",
      archived: "Заархівовано"
    }
  },
  /** Панель адміністратора (T-026) — лише для запрошених адміністраторів. */
  admin: {
    title: "Панель адміністратора",
    description: "Адміністративна зона сайту асоціації Barykady Kultury.",
    badge: "Адмін",
    navLabel: "Навігація адміністратора",
    dashboard: "Панель керування",
    backToSite: "Повернутися до публічного сайту",
    signOut: "Вийти",
    signIn: {
      title: "Вхід",
      description: "Вхід адміністратора сайту асоціації Barykady Kultury.",
      heading: "Вхід адміністратора",
      intro:
        "Доступ мають лише запрошені адміністратори. Облікові записи створює організація — самостійна реєстрація неможлива.",
      emailLabel: "Електронна пошта",
      passwordLabel: "Пароль",
      submit: "Увійти",
      submitting: "Вхід…",
      /* Нейтральне: після входу можна відкрити будь-яку адміністративну сторінку. */
      success: "Ви увійшли. Відкриваю…",
      errors: {
        emailRequired: "Введіть адресу електронної пошти.",
        emailInvalid: "Введіть коректну адресу електронної пошти.",
        passwordRequired: "Введіть пароль.",
        invalidCredentials: "Невірна адреса електронної пошти або пароль.",
        unavailable: "Вхід ще не налаштовано на цьому сайті.",
        unexpected: "Не вдалося увійти. Спробуйте ще раз."
      }
    },
    dashboardPage: {
      title: "Панель керування адміністратора",
      description: "Огляд адміністративної зони асоціації Barykady Kultury.",
      heading: "Панель керування",
      welcome: "Ви увійшли як {email}.",
      placeholderHeading: "Що тут з’явиться",
      placeholder:
        "Інструменти керування вмістом — проєктами, сторінками, командою, публікаціями та подіями — з’являться тут, коли будуть готові."
    },
    denied: {
      title: "Немає авторизації",
      description: "Обліковий запис не має адміністративного доступу.",
      heading: "Немає авторизації",
      message:
        "Ви ввійшли в обліковий запис, але він не має прав адміністратора. Попросіть організацію запросити вас як адміністратора або увійдіть в інший обліковий запис.",
      switchAccount: "Увійти в інший обліковий запис"
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
    /* орудний після «лише … мовою» — форми за мовою вмісту (rev-1 F) */
    fallbackLanguageNames: {
      en: "англійською",
      pl: "польською",
      uk: "українською"
    },
    opensInNewTab: "відкривається в новій вкладці"
  }
};

export default uk;
