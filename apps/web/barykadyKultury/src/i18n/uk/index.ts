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
    /** Коротка мітка tooltipa (ланка хедера). */
    triggerTooltip: "Пошук",
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
      decrease: "Зменшити",
      increase: "Збільшити",
      reset: "Скинути налаштування",
      resetDone: "Налаштування читання скинуто до типових.",
      downloadOriginal: "Завантажити оригінальний файл."
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
    /** Смуга телефону: шторка містить повне меню — нижня панель є головною навігацією. */
    fullMenu: "Повне меню",
    /** Пункт нижньої панелі, що відкриває всі розділи. */
    more: "Більше",
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
  /**
   * T-043 — localized accessible/visible names for social platforms. Brand
   * names stay in their official Latin form in every locale; a platform
   * without an entry falls back to the configured link label.
   */
  social: {
    labels: {
      facebook: "Facebook",
      instagram: "Instagram",
      telegram: "Telegram",
      youtube: "YouTube",
      twitter: "X (Twitter)",
      linkedin: "LinkedIn"
    }
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
    /** T-043 — heading above the labeled social block on the Contact page. */
    followUs: "Підписуйтесь на нас",
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
    /** T-027 — керування проєктами: поля, мовні вкладки, життєвий цикл. */
    projects: {
      title: "Проєкти",
      description: "Створюйте проєкти організації та керуйте ними.",
      heading: "Проєкти",
      intro:
        "Створюйте, редагуйте, переглядайте та публікуйте проєкти. Чернетки ніколи не видно публічно.",
      newProject: "Новий проєкт",
      filterLabel: "Фільтр за статусом",
      filterAll: "Усі статуси",
      statuses: {
        draft: "Чернетка",
        published: "Опубліковано",
        archived: "Архівовано"
      },
      empty: "Проєктів ще немає.",
      listFailed: "Не вдалося завантажити проєкти.",
      retry: "Спробувати знову",
      updated: "Оновлено {date}",
      updatedLabel: "Оновлено",
      completeness: {
        label: "Повнота перекладів",
        complete: "Повний",
        incomplete: "Неповний",
        notStarted: "Не розпочато",
        missing: "Відсутні: {fields}"
      },
      fields: {
        slug: "Ідентифікатор URL",
        slugHint:
          "Спільний для всіх мов; малі літери, цифри та дефіси. Ніколи не змінюється автоматично разом із заголовком.",
        status: "Статус",
        featured: "Показати на головній сторінці",
        featuredHint: "Порядок на головній сторінці налаштовується окремо.",
        startDate: "Дата початку",
        endDate: "Дата завершення",
        cover: "Обкладинка",
        coverHint: "PNG, JPEG або WebP. Необов’язково.",
        coverChoose: "Вибрати зображення",
        coverSelected: "Вибрано: {name}",
        coverCurrent:
          "Обкладинку вже збережено. Вибір нового зображення замінить її."
      },
      tabs: {
        label: "Мовні версії",
        en: "Англійська",
        pl: "Польська",
        uk: "Українська"
      },
      translation: {
        title: "Заголовок",
        summary: "Короткий опис",
        body: "Текст",
        bodyHint: "Звичайний текст або Markdown. Сирий HTML не відображається."
      },
      actions: {
        save: "Зберегти",
        saving: "Збереження…",
        publish: "Опублікувати",
        publishing: "Публікація…",
        unpublish: "Зняти з публікації",
        unpublishing: "Зняття з публікації…",
        archive: "Архівувати",
        archiving: "Архівування…",
        delete: "Видалити",
        deleting: "Видалення…",
        preview: "Попередній перегляд",
        cancel: "Скасувати",
        back: "Назад до проєктів"
      },
      messages: {
        draftSaved: "Чернетку збережено.",
        published: "Опубліковано. Проєкт тепер публічний.",
        unpublished: "Знято з публікації. Проєкт більше не публічний.",
        archived: "Архівовано.",
        deleted: "Проєкт видалено."
      },
      errors: {
        slugRequired: "Введіть ідентифікатор URL.",
        slugFormat:
          "Використовуйте малі літери, цифри та дефіси, наприклад spring-workshop.",
        slugDuplicate: "Цей ідентифікатор URL уже використовує інший проєкт.",
        startDateInvalid: "Введіть коректну дату початку.",
        endDateBeforeStart:
          "Дата завершення не може бути раніше за дату початку.",
        translationTitleRequired:
          "Введіть заголовок, перш ніж додавати опис або текст.",
        publishFallbackIncomplete:
          "Додайте англійський заголовок і короткий опис перед публікацією.",
        saveFailed: "Не вдалося зберегти проєкт. Спробуйте ще раз.",
        loadFailed: "Не вдалося завантажити проєкт.",
        unavailable: "Сервіс вмісту не налаштований.",
        uploadFailed: "Не вдалося завантажити обкладинку.",
        notAnImage: "Виберіть зображення PNG, JPEG або WebP.",
        deleteFailed: "Не вдалося видалити проєкт. Спробуйте ще раз.",
        notFound: "Проєкт не знайдено."
      },
      deleteDialog: {
        title: "Видалити цей проєкт?",
        message:
          "Це остаточно видалить проєкт та його переклади. Скасувати цю дію неможливо.",
        confirm: "Видалити проєкт"
      },
      preview: {
        title: "Перегляд чернетки",
        description: "Попередній перегляд проєкту для адміністратора.",
        banner: "Перегляд чернетки — цей проєкт не видно публічно.",
        incomplete:
          "Ще немає повного перекладу. Додайте заголовок, короткий опис і текст, щоб переглянути проєкт.",
        back: "Назад до редактора"
      }
    },
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
        "Інструменти керування вмістом — сторінками, командою, публікаціями та подіями — з’являться тут, коли будуть готові."
    },
    denied: {
      title: "Немає авторизації",
      description: "Обліковий запис не має адміністративного доступу.",
      heading: "Немає авторизації",
      message:
        "Ви ввійшли в обліковий запис, але він не має прав адміністратора. Попросіть організацію запросити вас як адміністратора або увійдіть в інший обліковий запис.",
      switchAccount: "Увійти в інший обліковий запис"
    },
    import: {
      title: "Імпорт вмісту",
      description:
        "Імпортуйте мовну версію документа або публікації з Google Docs у спільній папці НГО на Google Диску.",
      heading: "Імпорт вмісту",
      intro:
        "Підключіть свій обліковий запис Google, відкрийте документ Google зі спільної папки НГО на Google Диску, перегляньте безпечний попередній перегляд і метадані, а потім опублікуйте. Публічний сайт показує збережену копію, ніколи не iframe.",
      provider: {
        legend: "Джерело",
        file: "Файл",
        google: "Google Docs"
      },
      fields: {
        kind: "Тип вмісту",
        document: "Документ",
        publication: "Публікація",
        locale: "Мова",
        title: "Заголовок",
        titleHint: "Обов’язковий для кожної мовної версії.",
        description: "Опис або анотація",
        documentType: "Тип документа",
        slug: "Ідентифікатор URL",
        slugHint: "Спільний для всіх мов; малі літери, цифри та дефіси.",
        allowOriginalDownload: "Дозволити завантаження оригіналу",
        allowOriginalDownloadHint:
          "Вимкнено за замовчуванням. Коли ввімкнено, читач пропонує короткочасне підписане завантаження."
      },
      file: {
        label: "Файл Markdown або Word",
        hint: "Приймаються: .md і .docx. Файли .odt/.docm відхиляються з підказкою зберегти як DOCX.",
        choose: "Вибрати файл",
        selected: "Вибраний файл",
        converting: "Перетворення…"
      },
      google: {
        label: "Ідентифікатор або URL документа Google",
        hint: "Експорт із Drive — DOCX; публічний сайт показує збережену копію, ніколи не iframe.",
        import: "Імпортувати з Google",
        syncNow: "Синхронізувати зараз",
        check: "Перевірити зміни",
        syncing: "Перевірка Google Drive…",
        connectionHeading: "Обліковий запис Google",
        connect: "Підключити обліковий запис Google",
        picker: "Вибрати з Google Диску",
        pickerHint:
          "Основний шлях. Вибір показує лише документи зі спільної папки НГО на Google Диску.",
        pickerSelected:
          "Вибрано «{name}». Додайте заголовок, а потім імпортуйте.",
        pickerUnavailable:
          "Вибір Google недоступний. Вставте посилання на документ Google нижче.",
        manualLabel: "Запасний варіант: ідентифікатор або URL документа Google",
        manualHint:
          "Використовуйте це, лише якщо вибір недоступний або розгортання використовує серверні облікові дані.",
        reconnect: "Повторно підключити обліковий запис Google",
        connectedAs: "Підключено як {email}",
        disconnect: "Відключити обліковий запис Google",
        connectionRequired:
          "Підключіть свій обліковий запис Google, щоб імпортувати зі спільної папки НГО на Google Диску.",
        connectionUnavailable: "Стан підключення до Google недоступний.",
        folderHint:
          "Імпортувати можна лише документи зі спільної папки НГО на Google Диску."
      },
      preview: {
        heading: "Безпечний попередній перегляд",
        empty:
          "Виберіть файл або документ Google, щоб побачити попередній перегляд.",
        blocking: "Вирішіть ці проблеми перед публікацією:",
        warning: "Примітки до перетворення:",
        altLabel: "Альтернативний текст для {file}",
        altHint: "Обов’язковий для кожного інформативного зображення."
      },
      actions: {
        publish: "Опублікувати",
        publishing: "Публікація…",
        saveDraft: "Зберегти чернетку",
        savingDraft: "Збереження…"
      },
      status: {
        converted:
          "Перетворено. Перегляньте попередній перегляд і заголовок, а потім опублікуйте.",
        published:
          "Опубліковано. Публічний читач тепер може показати цю версію.",
        draftSaved: "Чернетку збережено.",
        unchanged: "У Google Drive немає нових змін.",
        updateAvailable: "Доступне оновлення.",
        checking: "Перевірка…",
        failed: "Імпорт не завершено."
      },
      sync: {
        heading: "Синхронізація Google",
        lastSynced: "Остання синхронізація: {time}",
        never: "Ще не синхронізовано",
        jobQueued: "У черзі…",
        jobRunning: "Синхронізація…",
        jobSucceeded: "Синхронізацію завершено.",
        jobUnchanged: "Версія актуальна.",
        jobBlocked: "Синхронізацію заблокували проблеми з вмістом.",
        jobFailed: "Синхронізація не вдалася. Опублікована копія не змінена.",
        diffHeading: "Підсумок змін",
        blocks: "{previous} → {next} блоків",
        headings: "{count} заголовків",
        images: "{count} зображень",
        tables: "{count} таблиць",
        added: "Додано: {items}",
        removed: "Видалено: {items}"
      },
      errors: {
        titleRequired: "Введіть заголовок.",
        slugRequired: "Введіть ідентифікатор URL.",
        noFile: "Спочатку виберіть файл.",
        conversionFailed: "Не вдалося перетворити файл.",
        publishFailed: "Не вдалося зберегти імпорт.",
        googleFailed: "Не вдалося запустити синхронізацію Google.",
        googleConnectRequired:
          "Підключіть обліковий запис Google перед імпортом з Google Docs.",
        googleReconnectRequired:
          "Доступ до Google минув або був відкликаний. Підключіть обліковий запис Google знову.",
        googleOutOfFolder:
          "Цей документ Google поза спільною папкою НГО. Перемістіть його до спільної папки й спробуйте знову.",
        googleFolderNotConfigured:
          "Спільну папку Google Drive не налаштовано. Зверніться до адміністратора сайту.",
        googleTokenTimeout:
          "Вхід до Google тривав занадто довго. Спробуйте знову.",
        googleMetadataTimeout:
          "Google Диск не відповів вчасно. Спробуйте знову.",
        googleExportTimeout:
          "Експорт документа Google тривав занадто довго. Спробуйте знову.",
        noSupabase: "Сервіс вмісту не налаштований.",
        blocking: "Відсутній альтернативний текст зображення блокує публікацію."
      },
      schedule: {
        heading: "Запланована свіжість",
        description:
          "Щоночі завдання перевіряє Google Docs і оновлює змінені копії. Ручна синхронізація залишається перевизначенням.",
        lastRun: "Останній запуск за розкладом",
        checked: "Перевірено {count}",
        updated: "Оновлено {count}",
        failed: "Помилок {count}",
        skipped: "Пропущено {count}",
        none: "Запуск за розкладом ще не записано."
      }
    },
    /** T-028 — редактор сторінок організації. */
    content: {
      title: "Сторінки",
      description: "Редагуйте вміст сторінок організації та їхні переклади.",
      heading: "Сторінки",
      intro:
        "Виберіть сторінку організації, відредагуйте кожну мовну версію та опублікуйте її, коли англійський запасний варіант буде повним.",
      empty: "Ще немає сторінок, які можна редагувати.",
      fields: {
        page: "Сторінка",
        pageHint: "Редагувати можна лише наявні сторінки організації.",
        status: "Статус",
        statusHint: "Неопубліковані сторінки не видно публічно."
      },
      statuses: {
        draft: "Чернетка",
        published: "Опублікована",
        archived: "Архівована"
      },
      tabs: {
        label: "Мовні версії",
        en: "Англійська",
        pl: "Польська",
        uk: "Українська"
      },
      translation: {
        title: "Заголовок",
        body: "Текст",
        bodyHint: "Звичайний текст або Markdown. Сирий HTML не відображається."
      },
      completeness: {
        complete: "Повний",
        notStarted: "Не розпочато",
        missing: "Відсутні: {fields}"
      },
      actions: {
        back: "Назад до панелі",
        save: "Зберегти",
        saving: "Збереження…",
        publish: "Опублікувати",
        publishing: "Публікація…",
        unpublish: "Зняти з публікації",
        unpublishing: "Зняття з публікації…",
        preview: "Перегляд"
      },
      messages: {
        saved: "Сторінку збережено.",
        published: "Опубліковано. Сторінка тепер публічна.",
        unpublished: "Знято з публікації. Сторінка більше не публічна."
      },
      errors: {
        unavailable: "Сервіс вмісту не налаштовано.",
        loadFailed: "Не вдалося завантажити сторінку.",
        notFound: "Сторінку не знайдено.",
        saveFailed: "Не вдалося зберегти сторінку. Спробуйте ще раз.",
        titleRequired: "Введіть заголовок перед додаванням тексту.",
        bodyRequired: "Введіть текст перед публікацією.",
        publishFallbackIncomplete:
          "Додайте англійський заголовок і текст перед публікацією."
      },
      preview: {
        title: "Перегляд сторінки",
        description: "Перегляд сторінки організації адміністратором.",
        banner:
          "Перегляд — ця сторінка не видима публічно, доки її не опубліковано.",
        back: "Назад до сторінок",
        incomplete:
          "Ще немає повного перекладу. Додайте заголовок і текст, щоб переглянути сторінку."
      }
    },
    /** T-028 — команда. Порядок змінюється кнопками Вгору/Вниз. */
    team: {
      title: "Команда",
      description: "Створюйте та керуйте членами команди організації.",
      heading: "Команда",
      intro:
        "Додавайте членів команди, редагуйте роль і біографію кожною мовою, задавайте порядок показу та публікуйте кожного окремо.",
      empty: "Ще немає членів команди.",
      statuses: {
        draft: "Чернетка",
        published: "Опублікований",
        archived: "Архівований"
      },
      fields: {
        name: "Ім'я та прізвище",
        nameHint: "Показується всіма мовами; не перекладається.",
        portrait: "Портрет",
        portraitHint: "PNG, JPEG або WebP. Необов'язковий.",
        portraitSelected: "Вибрано: {name}",
        portraitCurrent:
          "Портрет збережено. Вибір нового зображення замінить його."
      },
      tabs: {
        label: "Мовні версії",
        en: "Англійська",
        pl: "Польська",
        uk: "Українська"
      },
      translation: {
        role: "Роль",
        bio: "Коротка біографія"
      },
      completeness: {
        complete: "Повний",
        notStarted: "Не розпочато",
        missing: "Відсутні: {fields}"
      },
      actions: {
        back: "Назад до панелі",
        newMember: "Новий член",
        edit: "Редагувати",
        editMember: "Редагувати члена",
        moveUp: "Вгору",
        moveDown: "Вниз",
        publish: "Опублікувати",
        unpublish: "Зняти з публікації",
        save: "Зберегти",
        saving: "Збереження…",
        cancel: "Скасувати",
        delete: "Видалити",
        removePortrait: "Видалити портрет"
      },
      messages: {
        saved: "Члена команди збережено.",
        published: "Опубліковано. Член команди тепер публічний.",
        unpublished: "Знято з публікації. Член команди більше не публічний.",
        reordered: "Порядок показу збережено.",
        deleted: "Члена команди видалено."
      },
      errors: {
        nameRequired: "Введіть ім'я члена команди.",
        unavailable: "Сервіс вмісту не налаштовано.",
        loadFailed: "Не вдалося завантажити команду.",
        saveFailed: "Не вдалося зберегти члена команди. Спробуйте ще раз.",
        uploadFailed: "Не вдалося завантажити портрет.",
        notAnImage: "Виберіть зображення PNG, JPEG або WebP.",
        deleteFailed: "Не вдалося видалити члена команди. Спробуйте ще раз."
      },
      deleteDialog: {
        title: "Видалити цього члена команди?",
        message:
          "Це остаточно видалить члена команди, його переклади та портрет. Скасувати цю дію неможливо.",
        confirm: "Видалити члена"
      }
    },
    scopes: {
      label: "Ваші права доступу",
      pages: "Сторінки",
      projects: "Проєкти",
      publications: "Публікації",
      documents: "Документи",
      team: "Команда",
      events: "Події",
      media: "Медіафайли",
      importer: "Імпорт вмісту",
      deniedTitle: "Недоступно для вашої ролі",
      deniedMessage:
        "Ви ввійшли, але ваші права адміністратора не охоплюють цю область. Попросіть головного адміністратора надати їх."
    }
  },
  /**
   * T-041 імпорт вмісту (D-28/D-35). Коди помилок і попереджень надходять від
   * конвертера; тут лише локалізовані повідомлення.
   */
  import: {
    title: "Імпорт вмісту",
    description:
      "Імпортуйте файл Markdown або Word (.docx) і перегляньте перетворений вміст перед публікацією.",
    acceptedFormats: "Прийнятні формати: Markdown (.md) і Word (.docx).",
    errors: {
      emptyFile: "Вибраний файл порожній.",
      fileTooLarge: "Файл завеликий для імпорту.",
      invalidSize: "Розмір файлу некоректний.",
      invalidFileName: "Назва файлу некоректна.",
      unsupportedExtension:
        "Цей тип файлу не можна імпортувати. Використовуйте Markdown (.md) або Word (.docx).",
      unsupportedMime: "Тип файлу, повідомлений браузером, не підтримується.",
      mimeExtensionMismatch: "Назва файлу та його тип не збігаються.",
      activeContent:
        "Не можна імпортувати активний вміст, як-от HTML, SVG або JavaScript.",
      odtDeferred:
        "Формат OpenDocument (.odt) ще не підтримується. Збережіть документ як Word (.docx) у редакторі, а потім імпортуйте файл .docx.",
      docmRejected:
        "Документи Word із макросами (.docm) не приймаються. Збережіть документ як .docx без макросів, а потім імпортуйте його.",
      docxUnsafeZip:
        "Файл Word пошкоджений або перевищує безпечні обмеження імпорту.",
      docxMacros:
        "Файл Word містить макроси, які заборонені. Збережіть його як .docx без макросів.",
      docxInvalid: "Не вдалося прочитати файл Word.",
      emptyDocument: "Файл не містить читабельного вмісту.",
      conversionFailed:
        "Не вдалося перетворити файл. Перевірте файл і спробуйте ще раз.",
      conversionTimeout: "Перетворення тривало занадто довго й було зупинено."
    },
    warnings: {
      rawHtmlDropped: "Сирий HTML видалено з Markdown.",
      unsafeLink:
        "Посилання з непідтримуваною адресою перетворено на звичайний текст.",
      remoteImageStripped:
        "Віддалене зображення видалено. Завантажте зображення на сайт і вставте посилання на ресурс.",
      imageUnresolved:
        "Не вдалося пов’язати зображення із завантаженим ресурсом, тому його видалено.",
      nestedListFlattened:
        "Вкладений список вирівняно відповідно до формату читача.",
      unsupportedFormatting: "Деяке форматування спрощено для читача.",
      imageAltMissing:
        "Зображення не має альтернативного тексту. Додайте опис перед публікацією.",
      imageUnsupported:
        "Зображення в непідтримуваному форматі видалено. Використовуйте PNG, JPEG або WebP.",
      docxWarning: "Під час перетворення файлу Word виникло попередження."
    }
  },
  notFound: {
    title: "Сторінку не знайдено",
    description: "Запитану сторінку не знайдено.",
    message: "Запитану сторінку не знайдено."
  },
  content: {
    updateAvailable: "Доступне оновлення.",
    showUpdate: "Показати оновлення",
    updating: "Завантаження оновлення…",
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
