import type { MessageSchema } from "../en";

/**
 * Polish messages. Typed against the English master schema so the key set can
 * never drift (T-009 catalogue parity).
 * Only verified organization facts belong here — no placeholder contact details.
 */
const pl: MessageSchema = {
  app: {
    name: "Barykady Kultury"
  },
  brand: {
    logoLabel: "Barykady Kultury"
  },
  common: {
    skipToContent: "Przejdź do treści"
  },
  /** Spis treści scalonych stron (T-039, D-25). */
  toc: {
    onThisPage: "Na tej stronie"
  },
  /** Wyszukiwanie w nagłówku (T-039, D-26). */
  search: {
    trigger: "Szukaj w serwisie",
    /** Krótka etykieta tooltipa (pass nagłówka). */
    triggerTooltip: "Szukaj",
    dialogTitle: "Szukaj w serwisie",
    inputLabel: "Szukaj",
    placeholder: "Szukaj stron, projektów, publikacji…",
    close: "Zamknij wyszukiwanie",
    hint: "Wpisz co najmniej dwa znaki. Wyniki nawigacji pojawiają się natychmiast.",
    navSection: "Nawigacja",
    contentSection: "Treści",
    loading: "Wyszukiwanie…",
    noContent: "Brak wyników treści.",
    errorContent: "Wyniki treści są niedostępne.",
    errorEvents: "Wyniki wydarzeń są niedostępne.",
    retry: "Spróbuj ponownie",
    counts: "Wyniki: nawigacja {navCount}, treści {contentCount}",
    filtersLabel: "Filtruj wyniki",
    filters: {
      all: "Wszystko",
      pages: "Strony",
      projects: "Projekty",
      publications: "Publikacje",
      documents: "Dokumenty",
      team: "Zespół",
      events: "Wydarzenia"
    },
    navKinds: {
      page: "Strona",
      section: "Sekcja"
    },
    contentKinds: {
      page: "Strona",
      project: "Projekt",
      publication: "Publikacja",
      document: "Dokument",
      team: "Członek zespołu",
      event: "Wydarzenie"
    },
    /** Teksty rejestru nawigacji (przegląd T-039: kluster strukturalny). */
    navEntries: {
      home: {
        title: "Strona główna",
        description: "Strona główna i przegląd organizacji"
      },
      about: {
        title: "O nas",
        description: "Misja, historia, wartości, cele, zespół i dokumenty"
      },
      projects: {
        title: "Projekty",
        description: "Wszystkie projekty, najpierw wyróżnione"
      },
      publications: {
        title: "Publikacje",
        description: "Raporty i materiały według roku"
      },
      events: {
        title: "Wydarzenia",
        description: "Nadchodzące wydarzenia i kalendarz"
      },
      support: {
        title: "Wesprzyj nas",
        description: "Sposoby wsparcia stowarzyszenia"
      },
      contact: {
        title: "Kontakt",
        description: "Dane kontaktowe stowarzyszenia"
      },
      "about-mission": {
        title: "Misja",
        description: "Sekcja misji na stronie O nas"
      },
      "about-history": {
        title: "Historia",
        description: "Sekcja historii na stronie O nas"
      },
      "about-values": {
        title: "Wartości",
        description: "Sekcja wartości na stronie O nas"
      },
      "about-aims": {
        title: "Cele",
        description: "Sekcja celów na stronie O nas"
      },
      "about-team": {
        title: "Zespół",
        description: "Członkowie zespołu na stronie O nas"
      },
      "about-documents": {
        title: "Dokumenty",
        description: "Regulaminy, raporty i oficjalne pliki"
      },
      "projects-featured": {
        title: "Wyróżnione",
        description: "Sekcja wyróżnionych projektów na stronie Projekty"
      },
      "projects-all": {
        title: "Wszystkie projekty",
        description: "Wszystkie opublikowane projekty na stronie Projekty"
      },
      "events-upcoming": {
        title: "Nadchodzące",
        description: "Sekcja nadchodzących wydarzeń na stronie Wydarzenia"
      },
      "events-past": {
        title: "Minione",
        description: "Sekcja minionych wydarzeń na stronie Wydarzenia"
      },
      "events-calendar": {
        title: "Kalendarz",
        description: "Informacje o kalendarzu na stronie Wydarzenia"
      },
      "home-mission": {
        title: "Nasza misja",
        description: "Sekcja misji na stronie głównej"
      },
      "home-upcoming": {
        title: "Nadchodzące wydarzenia",
        description: "Nadchodzące wydarzenia na stronie głównej"
      },
      "home-featured": {
        title: "Wyróżnione projekty",
        description: "Wyróżnione projekty na stronie głównej"
      },
      "home-explore": {
        title: "Odkrywaj",
        description: "Kontakt, wsparcie i dalsze linki"
      },
      year: { description: "Publikacje z roku {year}" }
    }
  },
  /** Ujednolicony czytnik treści długich (T-040). */
  reader: {
    retry: "Spróbuj ponownie",
    language: {
      label: "Język czytanej treści"
    },
    toc: {
      label: "Spis treści",
      show: "Pokaż spis treści",
      hide: "Ukryj spis treści"
    },
    controls: {
      heading: "Ustawienia czytania",
      textSize: "Rozmiar tekstu",
      /* Krok 0 to baseline 16 px — etykiety zaczynają się od „Normalny". */
      sizes: {
        "0": "Normalny",
        "1": "Duży",
        "2": "Bardzo duży",
        "3": "Maksymalny"
      },
      spacingValues: {
        "0": "Standardowy",
        "1": "Luźniejszy",
        "2": "Otwarty",
        "3": "Szeroki"
      },
      measure: "Szerokość wiersza",
      measureValues: {
        narrow: "Wąska",
        medium: "Średnia",
        wide: "Szeroka"
      },
      lineSpacing: "Odstęp wierszy",
      decrease: "Zmniejsz",
      increase: "Zwiększ",
      reset: "Przywróć domyślne",
      resetDone: "Przywrócono domyślne ustawienia czytania.",
      downloadOriginal: "Pobierz oryginalny plik."
    },
    states: {
      empty: "Ten tekst jest niedostępny.",
      unsupported: "Ten tekst nie jest jeszcze dostępny w wersji do czytania.",
      unsupportedDownload: " Oryginalny plik można nadal pobrać poniżej."
    }
  },
  nav: {
    language: "Język",
    changeLanguage: "Zmień język",
    openMenu: "Otwórz menu nawigacji",
    closeMenu: "Zamknij menu nawigacji",
    mainNav: "Nawigacja główna",
    /** Pasma telefonów: szuflada zawiera pełne menu — dolny pasek jest nawigacją główną. */
    fullMenu: "Pełne menu",
    /** Pozycja dolnego paska otwierająca wszystkie sekcje. */
    more: "Więcej",
    contact: "Kontakt",
    about: "O nas",
    support: "Wesprzyj nas",
    projects: "Projekty",
    events: "Wydarzenia",
    publications: "Publikacje"
  },
  footer: {
    nav: "Nawigacja stopki",
    privacyPolicy: "Polityka prywatności",
    socialNav: "Media społecznościowe"
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
    darkMode: "Tryb ciemny"
  },
  home: {
    title: "Barykady Kultury",
    description: "Oficjalna strona stowarzyszenia Barykady Kultury.",
    sections: {
      mission: "Nasza misja",
      events: "Nadchodzące wydarzenia",
      projects: "Wyróżnione projekty",
      explore: "Odkrywaj"
    },
    allEvents: "Wszystkie wydarzenia",
    allProjects: "Wszystkie projekty",
    eventsEmpty: "Brak nadchodzących wydarzeń.",
    missionEmpty: "Przygotowujemy informacje o nas. Zapraszamy wkrótce."
  },
  contact: {
    title: "Kontakt",
    description: "Dane kontaktowe Barykad Kultury.",
    notConfigured: "Dane kontaktowe nie zostały jeszcze opublikowane.",
    guidance:
      "W międzyczasie możesz dowiedzieć się więcej o nas lub znaleźć sposoby wsparcia:",
    emailSubject: "Wiadomość ze strony internetowej",
    /** T-043 — heading above the labeled social block on the Contact page. */
    followUs: "Obserwuj nas",
    fields: {
      email: "E-mail",
      phone: "Telefon",
      address: "Adres",
      officeHours: "Godziny pracy"
    }
  },
  about: {
    title: "O nas",
    description: "O stowarzyszeniu Barykady Kultury.",
    placeholder: "Informacje o nas są w przygotowaniu."
  },
  aboutTeam: {
    title: "Zespół",
    description: "Zespół Barykad Kultury.",
    empty: "Brak opublikowanych członków zespołu."
  },
  aboutDocuments: {
    title: "Dokumenty",
    description: "Dokumenty organizacyjne Barykad Kultury.",
    placeholder: "Dokumenty są w przygotowaniu.",
    empty: "Brak dostępnych dokumentów.",
    reader: {
      back: "Powrót do dokumentów",
      notFound: "Ten dokument jest niedostępny.",
      unavailable: "Ten dokument nie jest dostępny w wybranym języku."
    },
    types: {
      regulations: "Regulamin",
      statute: "Statut",
      report: "Sprawozdanie"
    }
  },
  support: {
    title: "Wesprzyj nas",
    description: "Wesprzyj stowarzyszenie Barykady Kultury.",
    intro: "Możesz wesprzeć nasze działania w poniższy sposób.",
    empty:
      "Formy wsparcia stowarzyszenia są przygotowywane. Zapraszamy ponownie później.",
    noPayment:
      "Nie przetwarzamy płatności kartowych w tej witrynie. Wsparcia udziela się bezpośrednio na stronie zweryfikowanego odbiorcy lub jako przelew bankowy.",
    actions: {
      donation: "Wesprzyj nas datkiem",
      volunteering: "Zgłoś chęć wolontariatu"
    },
    bank: {
      heading: "Przelew bankowy",
      accountNumber: "Numer konta",
      recipient: "Odbiorca",
      paymentTitle: "Tytuł przelewu"
    }
  },
  events: {
    title: "Wydarzenia",
    description: "Nadchodzące wydarzenia organizowane przez Barykady Kultury.",
    upcoming: "Nadchodzące",
    past: "Minione",
    calendar: "Kalendarz",
    pastEmpty:
      "Minione wydarzenia nie są tu jeszcze publikowane — kanał kalendarza zawiera wyłącznie wydarzenia nadchodzące.",
    calendarNote:
      "Ta lista pochodzi z kalendarza wydarzeń organizacji. Masz pytanie o wydarzenie?",
    empty: "Brak nadchodzących wydarzeń. Zapraszamy ponownie wkrótce.",
    calendarUnavailable: "Kalendarz wydarzeń jest czasowo niedostępny.",
    retry: "Spróbuj ponownie",
    contactFallback: "Skontaktuj się z nami w sprawie wydarzeń",
    loaded: "Nadchodzące wydarzenia: {count}.",
    languageNote: "Szczegóły wydarzenia podaje organizator w języku oryginału.",
    allDay: "Całodniowe",
    register: "Zapisz się",
    registerFor: "na {title}",
    rangeTo: "do",
    projectLabel: "Powiązany projekt:"
  },
  publications: {
    title: "Publikacje",
    description: "Publikacje Barykad Kultury.",
    empty: "Brak dostępnych publikacji.",
    undated: "Bez daty",
    detail: {
      back: "Powrót do publikacji",
      filesHeading: "Dostępne pliki"
    },
    availability: {
      download: "Pobieranie",
      online: "Online"
    },
    external: "Otwórz online"
  },
  projects: {
    title: "Projekty",
    description: "Projekty realizowane przez stowarzyszenie Barykady Kultury.",
    empty: "Brak dostępnych projektów.",
    featured: "Wyróżnione",
    all: "Wszystkie projekty",
    detail: {
      back: "Powrót do projektów"
    },
    status: {
      published: "Opublikowany",
      draft: "Szkic",
      archived: "Zarchiwizowany"
    }
  },
  /** Panel administracyjny (T-026) — wyłącznie dla zaproszonych administratorów. */
  admin: {
    title: "Panel administratora",
    description:
      "Strefa administratora strony stowarzyszenia Barykady Kultury.",
    badge: "Admin",
    navLabel: "Nawigacja administratora",
    dashboard: "Pulpit",
    backToSite: "Powrót do serwisu publicznego",
    signOut: "Wyloguj się",
    /** T-027 — zarządzanie projektami: pola, zakładki językowe, cykl życia. */
    projects: {
      title: "Projekty",
      description: "Twórz projekty organizacji i zarządzaj nimi.",
      heading: "Projekty",
      intro:
        "Twórz, edytuj, przeglądaj i publikuj projekty. Szkice nigdy nie są widoczne publicznie.",
      newProject: "Nowy projekt",
      filterLabel: "Filtruj według statusu",
      filterAll: "Wszystkie statusy",
      statuses: {
        draft: "Szkic",
        published: "Opublikowany",
        archived: "Zarchiwizowany"
      },
      empty: "Brak projektów.",
      listFailed: "Nie udało się wczytać projektów.",
      retry: "Spróbuj ponownie",
      updated: "Zaktualizowano {date}",
      updatedLabel: "Zaktualizowano",
      completeness: {
        label: "Kompletność tłumaczeń",
        complete: "Kompletna",
        incomplete: "Niekompletna",
        notStarted: "Nierozpoczęta",
        missing: "Brakuje: {fields}"
      },
      fields: {
        slug: "Identyfikator URL",
        slugHint:
          "Wspólny dla wszystkich języków; małe litery, cyfry i myślniki. Nigdy nie zmienia się automatycznie razem z tytułem.",
        status: "Status",
        featured: "Wyróżnij na stronie głównej",
        featuredHint: "Kolejność na stronie głównej ustala się osobno.",
        startDate: "Data rozpoczęcia",
        endDate: "Data zakończenia",
        cover: "Obraz okładki",
        coverHint: "PNG, JPEG lub WebP. Opcjonalny.",
        coverChoose: "Wybierz obraz",
        coverSelected: "Wybrano: {name}",
        coverCurrent:
          "Okładka jest już zapisana. Wybranie nowego obrazu zastąpi ją."
      },
      tabs: {
        label: "Wersje językowe",
        en: "Angielski",
        pl: "Polski",
        uk: "Ukraiński"
      },
      translation: {
        title: "Tytuł",
        summary: "Podsumowanie",
        body: "Treść",
        bodyHint: "Zwykły tekst lub Markdown. Surowy HTML nie jest renderowany."
      },
      actions: {
        save: "Zapisz",
        saving: "Zapisywanie…",
        publish: "Opublikuj",
        publishing: "Publikowanie…",
        unpublish: "Wycofaj publikację",
        unpublishing: "Wycofywanie…",
        archive: "Zarchiwizuj",
        archiving: "Archiwizowanie…",
        delete: "Usuń",
        deleting: "Usuwanie…",
        preview: "Podgląd",
        cancel: "Anuluj",
        back: "Powrót do projektów"
      },
      messages: {
        draftSaved: "Szkic zapisany.",
        published: "Opublikowano. Projekt jest teraz publiczny.",
        unpublished: "Wycofano publikację. Projekt nie jest już publiczny.",
        archived: "Zarchiwizowano.",
        deleted: "Projekt usunięty."
      },
      errors: {
        slugRequired: "Wpisz identyfikator URL.",
        slugFormat:
          "Użyj małych liter, cyfr i myślników, na przykład spring-workshop.",
        slugDuplicate:
          "Ten identyfikator URL jest już używany przez inny projekt.",
        startDateInvalid: "Wpisz prawidłową datę rozpoczęcia.",
        endDateBeforeStart:
          "Data zakończenia nie może być wcześniejsza niż data rozpoczęcia.",
        translationTitleRequired:
          "Wpisz tytuł, zanim dodasz podsumowanie lub treść.",
        publishFallbackIncomplete:
          "Dodaj angielski tytuł i podsumowanie przed publikacją.",
        saveFailed: "Nie udało się zapisać projektu. Spróbuj ponownie.",
        loadFailed: "Nie udało się wczytać projektu.",
        unavailable: "Usługa treści nie jest skonfigurowana.",
        uploadFailed: "Nie udało się przesłać obrazu okładki.",
        notAnImage: "Wybierz obraz PNG, JPEG lub WebP.",
        deleteFailed: "Nie udało się usunąć projektu. Spróbuj ponownie.",
        notFound: "Nie znaleziono projektu."
      },
      deleteDialog: {
        title: "Usunąć ten projekt?",
        message:
          "Spowoduje to trwałe usunięcie projektu i jego tłumaczeń. Tej operacji nie można cofnąć.",
        confirm: "Usuń projekt"
      },
      preview: {
        title: "Podgląd szkicu",
        description: "Podgląd projektu dla administratora.",
        banner: "Podgląd szkicu — ten projekt nie jest widoczny publicznie.",
        incomplete:
          "Brak jeszcze kompletnego tłumaczenia. Dodaj tytuł, podsumowanie i treść, aby zobaczyć podgląd projektu.",
        back: "Powrót do edytora"
      }
    },
    /**
     * T-030 — kolejność projektów wyróżnionych na stronie głównej.
     */
    featured: {
      title: "Wyróżnione projekty",
      description:
        "Wybierz projekty wyróżnione na stronie głównej i ustal ich kolejność.",
      heading: "Wyróżnione projekty",
      intro:
        "Wybierz opublikowane projekty widoczne na stronie głównej i ustal ich kolejność. Gdy lista jest pusta, strona główna pokazuje ostatnio zaktualizowane opublikowane projekty.",
      featuredHeading: "Kolejność na stronie głównej",
      availableHeading: "Dodaj opublikowany projekt",
      empty:
        "Brak wyróżnionych projektów. Strona główna pokazuje obecnie ostatnio opublikowane projekty.",
      availableEmpty: "Brak innych opublikowanych projektów do dodania.",
      actions: {
        backToProjects: "Powrót do projektów",
        moveUp: "Przenieś w górę",
        moveDown: "Przenieś w dół",
        moveUpProject: "Przenieś „{title}” w górę",
        moveDownProject: "Przenieś „{title}” w dół",
        remove: "Usuń",
        removeProject: "Usuń „{title}” ze strony głównej",
        add: "Dodaj",
        addProject: "Dodaj „{title}” na stronę główną"
      },
      messages: {
        added: "Projekt dodany do kolejności na stronie głównej.",
        removed: "Projekt usunięty z kolejności na stronie głównej.",
        reordered: "Kolejność na stronie głównej zapisana."
      },
      errors: {
        loadFailed: "Nie udało się wczytać wyróżnionych projektów.",
        unavailable: "Usługa treści nie jest skonfigurowana.",
        notPublished: "Tylko opublikowane projekty mogą być wyróżnione.",
        notFound: "Nie znaleziono projektu.",
        failed: "Nie udało się zapisać zmiany. Spróbuj ponownie.",
        retry: "Spróbuj ponownie"
      }
    },
    upload: {
      validating: "Sprawdzanie pliku…",
      uploading: "Przesyłanie…",
      persisting: "Zapisywanie…",
      progressLabel: "Postęp przesyłania"
    },
    publications: {
      title: "Publikacje",
      description: "Zarządzaj publikacjami organizacji i wersjami plików.",
      heading: "Publikacje",
      intro:
        "Twórz i edytuj publikacje, dołącz jedną wersję pliku na język lub link zewnętrzny, a następnie opublikuj.",
      newPublication: "Nowa publikacja",
      empty: "Brak publikacji.",
      listFailed: "Nie udało się wczytać publikacji.",
      retry: "Spróbuj ponownie",
      updatedLabel: "Zaktualizowano",
      statuses: {
        draft: "Szkic",
        published: "Opublikowana",
        archived: "Zarchiwizowana"
      },
      completeness: {
        label: "Kompletność tłumaczeń",
        complete: "Kompletna",
        notStarted: "Nierozpoczęta",
        missing: "Brakuje: {fields}"
      },
      fields: {
        slug: "Adres URL (slug)",
        slugHint:
          "Wspólny dla wszystkich języków; małe litery, cyfry i myślniki.",
        status: "Status",
        language: "Język publikacji",
        languageNone: "Nie określono",
        publicationDate: "Data publikacji",
        externalUrl: "Link zewnętrzny",
        externalUrlHint:
          "Użyj linku zewnętrznego LUB wersji plików, nigdy obu. Pozostaw puste przy przesyłaniu plików.",
        sortOrder: "Kolejność",
        files: "Wersje plików",
        filesHint:
          "Jeden plik na język. PDF lub DOCX. Zastąpienie pliku usuwa starą wersję.",
        label: "Etykieta wersji",
        labelHint: "Opcjonalnie, np. „Pełny raport (PDF)”.",
        chooseFile: "Wybierz plik",
        fileSelected: "Wybrano: {name}",
        currentFile: "Zapisany plik: {name}",
        removeFile: "Usuń tę wersję",
        noFile: "Brak pliku dla tego języka.",
        existing: "Zapisany"
      },
      tabs: {
        label: "Wersje językowe",
        en: "Angielski",
        pl: "Polski",
        uk: "Ukraiński"
      },
      translation: {
        title: "Tytuł",
        abstract: "Streszczenie",
        authors: "Autorzy lub organizacja"
      },
      actions: {
        save: "Zapisz",
        saving: "Zapisywanie…",
        publish: "Opublikuj",
        publishing: "Publikowanie…",
        unpublish: "Wycofaj",
        unpublishing: "Wycofywanie…",
        delete: "Usuń",
        deleting: "Usuwanie…",
        cancel: "Anuluj",
        back: "Wróć do publikacji",
        edit: "Edytuj"
      },
      messages: {
        draftSaved: "Szkic zapisany.",
        published: "Opublikowano. Publikacja jest teraz publiczna.",
        unpublished: "Wycofano. Publikacja nie jest już publiczna.",
        deleted: "Publikacja usunięta."
      },
      errors: {
        slugRequired: "Wpisz adres URL (slug).",
        slugFormat: "Użyj małych liter, cyfr i myślników, np. raport-roczny.",
        slugDuplicate: "Ten adres URL jest już używany przez inną publikację.",
        dateInvalid: "Wpisz poprawną datę publikacji.",
        externalUrlInvalid: "Wpisz poprawny adres http(s).",
        actionBoth: "Użyj linku zewnętrznego albo wersji plików — nie obu.",
        actionMissing:
          "Dodaj link zewnętrzny lub co najmniej jedną wersję pliku przed publikacją.",
        translationTitleRequired:
          "Wpisz tytuł przed dodaniem streszczenia lub autorów.",
        publishFallbackIncomplete: "Dodaj angielski tytuł przed publikacją.",
        saveFailed: "Nie udało się zapisać publikacji. Spróbuj ponownie.",
        loadFailed: "Nie udało się wczytać publikacji.",
        unavailable: "Usługa treści nie jest skonfigurowana.",
        uploadFailed: "Nie udało się przesłać pliku.",
        invalidUpload: "Wybrany plik jest niedozwolony.",
        activeContent: "Przesyłanie SVG, HTML i JavaScript jest niedozwolone.",
        unsupportedFile: "Wybierz plik PDF lub DOCX.",
        fileTooLarge: "Plik przekracza limit 50 MB.",
        deleteFailed: "Nie udało się usunąć publikacji. Spróbuj ponownie.",
        notFound: "Nie znaleziono publikacji."
      },
      deleteDialog: {
        title: "Usunąć tę publikację?",
        message:
          "Spowoduje to trwałe usunięcie publikacji, jej tłumaczeń i odwołań do plików. Zapisane pliki są usuwane w miarę możliwości. Tej operacji nie można cofnąć.",
        confirm: "Usuń publikację"
      }
    },
    documents: {
      title: "Dokumenty",
      description: "Zarządzaj dokumentami organizacji do pobrania.",
      heading: "Dokumenty",
      intro:
        "Przesyłaj dokumenty organizacji, takie jak statut i raporty, ustaw ich typ i język, a następnie opublikuj.",
      newDocument: "Nowy dokument",
      empty: "Brak dokumentów.",
      listFailed: "Nie udało się wczytać dokumentów.",
      retry: "Spróbuj ponownie",
      statuses: {
        draft: "Szkic",
        published: "Opublikowany",
        archived: "Zarchiwizowany"
      },
      completeness: {
        label: "Kompletność tłumaczeń",
        complete: "Kompletna",
        notStarted: "Nierozpoczęta",
        missing: "Brakuje: {fields}"
      },
      types: {
        regulations: "Regulamin",
        statute: "Statut",
        report: "Raport"
      },
      fields: {
        slug: "Adres URL (slug)",
        slugHint:
          "Wspólny dla wszystkich języków; małe litery, cyfry i myślniki.",
        status: "Status",
        documentType: "Typ dokumentu",
        language: "Język pliku",
        publicationDate: "Data publikacji",
        sortOrder: "Kolejność",
        sortOrderHint: "Niższe liczby pojawiają się pierwsze na stronie O nas.",
        file: "Plik dokumentu",
        fileHint: "PDF lub DOCX. Publiczne pobieranie działa bez logowania.",
        chooseFile: "Wybierz plik",
        fileSelected: "Wybrano: {name}",
        currentFile: "Zapisany plik: {name}",
        noFile: "Brak pliku (dokument tekstowy)."
      },
      tabs: {
        label: "Wersje językowe",
        en: "Angielski",
        pl: "Polski",
        uk: "Ukraiński"
      },
      translation: {
        title: "Tytuł",
        description: "Opis"
      },
      actions: {
        save: "Zapisz",
        saving: "Zapisywanie…",
        publish: "Opublikuj",
        publishing: "Publikowanie…",
        unpublish: "Wycofaj",
        unpublishing: "Wycofywanie…",
        delete: "Usuń",
        deleting: "Usuwanie…",
        cancel: "Anuluj",
        back: "Wróć do panelu",
        edit: "Edytuj",
        newDocument: "Nowy dokument"
      },
      messages: {
        saved: "Dokument zapisany.",
        published: "Opublikowano. Dokument jest teraz publiczny.",
        unpublished: "Wycofano. Dokument nie jest już publiczny.",
        deleted: "Dokument usunięty."
      },
      errors: {
        slugRequired: "Wpisz adres URL (slug).",
        slugFormat: "Użyj małych liter, cyfr i myślników, np. raport-roczny.",
        slugDuplicate: "Ten adres URL jest już używany przez inny dokument.",
        documentTypeRequired: "Wybierz typ dokumentu.",
        fileRequired: "Wybierz plik dokumentu.",
        dateInvalid: "Wpisz poprawną datę publikacji.",
        translationTitleRequired: "Wpisz tytuł przed dodaniem opisu.",
        publishFallbackIncomplete: "Dodaj angielski tytuł przed publikacją.",
        saveFailed: "Nie udało się zapisać dokumentu. Spróbuj ponownie.",
        loadFailed: "Nie udało się wczytać dokumentu.",
        unavailable: "Usługa treści nie jest skonfigurowana.",
        uploadFailed: "Nie udało się przesłać pliku.",
        invalidUpload: "Wybrany plik jest niedozwolony.",
        activeContent: "Przesyłanie SVG, HTML i JavaScript jest niedozwolone.",
        unsupportedFile: "Wybierz plik PDF lub DOCX.",
        fileTooLarge: "Plik przekracza limit 50 MB.",
        deleteFailed: "Nie udało się usunąć dokumentu. Spróbuj ponownie."
      },
      deleteDialog: {
        title: "Usunąć ten dokument?",
        message:
          "Spowoduje to trwałe usunięcie dokumentu, jego tłumaczeń i odwołania do pliku. Tej operacji nie można cofnąć.",
        confirm: "Usuń dokument"
      }
    },
    signIn: {
      title: "Logowanie",
      description:
        "Logowanie administratora strony stowarzyszenia Barykady Kultury.",
      heading: "Logowanie administratora",
      intro:
        "Dostęp mają wyłącznie zaproszeni administratorzy. Konta tworzy organizacja — samodzielna rejestracja nie jest możliwa.",
      emailLabel: "Adres e-mail",
      passwordLabel: "Hasło",
      submit: "Zaloguj się",
      submitting: "Logowanie…",
      /* Neutralne: celem logowania może być dowolna ścieżka administracji. */
      success: "Zalogowano. Otwieranie…",
      errors: {
        emailRequired: "Podaj adres e-mail.",
        emailInvalid: "Podaj poprawny adres e-mail.",
        passwordRequired: "Podaj hasło.",
        invalidCredentials: "Adres e-mail lub hasło są nieprawidłowe.",
        unavailable:
          "Logowanie nie jest jeszcze skonfigurowane na tej stronie.",
        unexpected: "Logowanie nie powiodło się. Spróbuj ponownie."
      }
    },
    dashboardPage: {
      title: "Pulpit administratora",
      description:
        "Przegląd strefy administracyjnej stowarzyszenia Barykady Kultury.",
      heading: "Pulpit",
      welcome: "Zalogowano jako {email}.",
      placeholderHeading: "Co tutaj się pojawi",
      placeholder:
        "Narzędzia zarządzania treścią — stronami, zespołem, publikacjami i wydarzeniami — pojawią się tutaj w miarę ich gotowości."
    },
    denied: {
      title: "Brak autoryzacji",
      description: "Zalogowane konto nie ma dostępu administracyjnego.",
      heading: "Brak autoryzacji",
      message:
        "Jesteś zalogowany, ale to konto nie ma uprawnień administratora. Poproś organizację o zaproszenie Cię jako administratora albo zaloguj się na inne konto.",
      switchAccount: "Zaloguj się na inne konto"
    },
    import: {
      title: "Import treści",
      description:
        "Importuj wersję językową dokumentu lub publikacji z Google Docs w udostępnionym folderze NGO na Dysku Google.",
      heading: "Import treści",
      intro:
        "Połącz swoje konto Google, otwórz dokument Google z udostępnionego folderu NGO na Dysku Google, sprawdź bezpieczny podgląd i metadane, a następnie opublikuj. Strona publiczna renderuje zapisaną kopię, nigdy iframe.",
      provider: {
        legend: "Źródło",
        file: "Plik",
        google: "Google Docs"
      },
      fields: {
        kind: "Typ treści",
        document: "Dokument",
        publication: "Publikacja",
        locale: "Język",
        title: "Tytuł",
        titleHint: "Wymagany dla każdej wersji językowej.",
        description: "Opis lub streszczenie",
        documentType: "Typ dokumentu",
        slug: "Identyfikator URL",
        slugHint:
          "Wspólny dla wszystkich języków; małe litery, cyfry i myślniki.",
        allowOriginalDownload: "Zezwól na pobranie oryginału",
        allowOriginalDownloadHint:
          "Domyślnie wyłączone. Po włączeniu czytnik oferuje krótkotrwałe podpisane pobranie."
      },
      file: {
        label: "Plik Markdown lub Word",
        hint: "Akceptowane: .md i .docx. Pliki .odt/.docm są odrzucane z instrukcją zapisu jako DOCX.",
        choose: "Wybierz plik",
        selected: "Wybrany plik",
        converting: "Konwertowanie…"
      },
      google: {
        label: "Identyfikator lub URL dokumentu Google",
        hint: "Eksport z Drive to DOCX; strona publiczna renderuje zapisaną kopię, nigdy iframe.",
        import: "Importuj z Google",
        syncNow: "Synchronizuj teraz",
        check: "Sprawdź zmiany",
        syncing: "Sprawdzanie Google Drive…",
        connectionHeading: "Konto Google",
        connect: "Połącz konto Google",
        picker: "Wybierz z Google Drive",
        pickerHint:
          "Ścieżka główna. Wybór pokazuje tylko dokumenty z udostępnionego folderu NGO na Dysku Google.",
        pickerSelected:
          "Wybrano „{name}”. Dodaj tytuł, a następnie zaimportuj.",
        pickerUnavailable:
          "Wybór Google jest niedostępny. Wklej poniżej link do dokumentu Google.",
        manualLabel: "Zapasowo: identyfikator lub URL dokumentu Google",
        manualHint:
          "Użyj tej opcji tylko wtedy, gdy wybór jest niedostępny lub wdrożenie używa poświadczenia serwera.",
        reconnect: "Ponownie połącz konto Google",
        connectedAs: "Połączono jako {email}",
        disconnect: "Odłącz konto Google",
        connectionRequired:
          "Połącz swoje konto Google, aby importować z udostępnionego folderu NGO na Dysku Google.",
        connectionUnavailable: "Stan połączenia z Google jest niedostępny.",
        folderHint:
          "Importować można tylko dokumenty z udostępnionego folderu NGO na Dysku Google."
      },
      preview: {
        heading: "Bezpieczny podgląd",
        empty: "Wybierz plik lub dokument Google, aby zobaczyć podgląd.",
        blocking: "Rozwiąż te problemy przed publikacją:",
        warning: "Uwagi z konwersji:",
        altLabel: "Tekst alternatywny dla {file}",
        altHint: "Wymagany dla każdego obrazu informacyjnego."
      },
      actions: {
        publish: "Opublikuj",
        publishing: "Publikowanie…",
        saveDraft: "Zapisz szkic",
        savingDraft: "Zapisywanie…"
      },
      status: {
        converted:
          "Przekonwertowano. Sprawdź podgląd i tytuł, a następnie opublikuj.",
        published:
          "Opublikowano. Czytnik publiczny może teraz pokazać tę wersję.",
        draftSaved: "Szkic zapisany.",
        unchanged: "Brak nowych zmian w Google Drive.",
        updateAvailable: "Dostępna jest aktualizacja.",
        checking: "Sprawdzanie…",
        failed: "Import nie został ukończony."
      },
      sync: {
        heading: "Synchronizacja Google",
        lastSynced: "Ostatnia synchronizacja: {time}",
        never: "Nigdy nie synchronizowano",
        jobQueued: "W kolejce…",
        jobRunning: "Synchronizowanie…",
        jobSucceeded: "Synchronizacja ukończona.",
        jobUnchanged: "Wersja jest aktualna.",
        jobBlocked: "Synchronizację zablokowały problemy z treścią.",
        jobFailed:
          "Synchronizacja nie powiodła się. Opublikowana kopia pozostała bez zmian.",
        diffHeading: "Podsumowanie zmian",
        blocks: "{previous} → {next} bloków",
        headings: "{count} nagłówków",
        images: "{count} obrazów",
        tables: "{count} tabel",
        added: "Dodano: {items}",
        removed: "Usunięto: {items}"
      },
      errors: {
        titleRequired: "Wpisz tytuł.",
        slugRequired: "Wpisz identyfikator URL.",
        noFile: "Najpierw wybierz plik.",
        conversionFailed: "Nie udało się przekonwertować pliku.",
        publishFailed: "Nie udało się zapisać importu.",
        googleFailed: "Nie udało się uruchomić synchronizacji Google.",
        googleConnectRequired:
          "Przed importem z Google Docs połącz swoje konto Google.",
        googleReconnectRequired:
          "Dostęp do Google wygasł lub został cofnięty. Połącz konto Google ponownie.",
        googleOutOfFolder:
          "Ten dokument Google znajduje się poza udostępnionym folderem NGO. Przenieś go do udostępnionego folderu i spróbuj ponownie.",
        googleFolderNotConfigured:
          "Udostępniony folder Google Drive nie jest skonfigurowany. Skontaktuj się z administratorem strony.",
        googleTokenTimeout:
          "Logowanie do Google trwało zbyt długo. Spróbuj ponownie.",
        googleMetadataTimeout:
          "Dysk Google nie odpowiedział na czas. Spróbuj ponownie.",
        googleExportTimeout:
          "Eksport dokumentu Google trwał zbyt długo. Spróbuj ponownie.",
        noSupabase: "Usługa treści nie jest skonfigurowana.",
        blocking: "Brak tekstu alternatywnego obrazu blokuje publikację."
      },
      schedule: {
        heading: "Harmonogram świeżości",
        description:
          "Nocne zadanie sprawdza Google Docs i aktualizuje zmienione kopie. Ręczna synchronizacja pozostaje nadpisaniem.",
        lastRun: "Ostatni uruchomiony harmonogram",
        checked: "Sprawdzono {count}",
        updated: "Zaktualizowano {count}",
        failed: "Błędy {count}",
        skipped: "Pominięto {count}",
        none: "Nie zapisano jeszcze uruchomienia harmonogramu."
      }
    },
    /** T-028 — edytor stron organizacji. */
    content: {
      title: "Strony",
      description: "Edytuj treść stron organizacji i ich tłumaczenia.",
      heading: "Strony",
      intro:
        "Wybierz stronę organizacji, edytuj każdą wersję językową i opublikuj ją, gdy angielska wersja zapasowa będzie kompletna.",
      empty: "Nie istnieją jeszcze żadne edytowalne strony.",
      fields: {
        page: "Strona",
        pageHint: "Można edytować tylko istniejące strony organizacji.",
        status: "Status",
        statusHint: "Nieopublikowane strony nie są widoczne publicznie."
      },
      statuses: {
        draft: "Szkic",
        published: "Opublikowana",
        archived: "Zarchiwizowana"
      },
      tabs: {
        label: "Wersje językowe",
        en: "Angielski",
        pl: "Polski",
        uk: "Ukraiński"
      },
      translation: {
        title: "Tytuł",
        body: "Treść",
        bodyHint: "Zwykły tekst lub Markdown. Surowy HTML nie jest renderowany."
      },
      completeness: {
        complete: "Kompletna",
        notStarted: "Nierozpoczęta",
        missing: "Brakuje: {fields}"
      },
      actions: {
        back: "Wróć do pulpitu",
        save: "Zapisz",
        saving: "Zapisywanie…",
        publish: "Opublikuj",
        publishing: "Publikowanie…",
        unpublish: "Cofnij publikację",
        unpublishing: "Cofanie publikacji…",
        preview: "Podgląd"
      },
      messages: {
        saved: "Strona zapisana.",
        published: "Opublikowano. Strona jest teraz publiczna.",
        unpublished: "Cofnięto publikację. Strona nie jest już publiczna."
      },
      errors: {
        unavailable: "Usługa treści nie jest skonfigurowana.",
        loadFailed: "Nie udało się wczytać strony.",
        notFound: "Nie znaleziono strony.",
        saveFailed: "Nie udało się zapisać strony. Spróbuj ponownie.",
        titleRequired: "Wpisz tytuł przed dodaniem treści.",
        bodyRequired: "Wpisz treść przed opublikowaniem.",
        publishFallbackIncomplete:
          "Dodaj angielski tytuł i treść przed opublikowaniem."
      },
      preview: {
        title: "Podgląd strony",
        description: "Podgląd strony organizacji dla administratora.",
        banner:
          "Podgląd — ta strona nie jest widoczna publicznie, dopóki nie zostanie opublikowana.",
        back: "Wróć do stron",
        incomplete:
          "Żadne tłumaczenie nie jest jeszcze kompletne. Dodaj tytuł i treść, aby zobaczyć podgląd."
      }
    },
    /** T-028 — zespół. Kolejność zmienia się przyciskami Góra/Dół. */
    team: {
      title: "Zespół",
      description: "Twórz i zarządzaj członkami zespołu organizacji.",
      heading: "Zespół",
      intro:
        "Dodawaj członków zespołu, edytuj rolę i biografię w każdym języku, ustal kolejność wyświetlania i publikuj każdego członka osobno.",
      empty: "Nie ma jeszcze członków zespołu.",
      statuses: {
        draft: "Szkic",
        published: "Opublikowany",
        archived: "Zarchiwizowany"
      },
      fields: {
        name: "Imię i nazwisko",
        nameHint: "Wyświetlane w każdym języku; nie jest tłumaczone.",
        portrait: "Portret",
        portraitHint: "PNG, JPEG lub WebP. Opcjonalny.",
        portraitSelected: "Wybrano: {name}",
        portraitCurrent:
          "Portret jest zapisany. Wybranie nowego obrazu go zastąpi."
      },
      tabs: {
        label: "Wersje językowe",
        en: "Angielski",
        pl: "Polski",
        uk: "Ukraiński"
      },
      translation: {
        role: "Rola",
        bio: "Krótka biografia"
      },
      completeness: {
        complete: "Kompletna",
        notStarted: "Nierozpoczęta",
        missing: "Brakuje: {fields}"
      },
      actions: {
        back: "Wróć do pulpitu",
        newMember: "Nowy członek",
        edit: "Edytuj",
        editMember: "Edytuj członka",
        moveUp: "W górę",
        moveDown: "W dół",
        publish: "Opublikuj",
        unpublish: "Cofnij publikację",
        save: "Zapisz",
        saving: "Zapisywanie…",
        cancel: "Anuluj",
        delete: "Usuń",
        removePortrait: "Usuń portret"
      },
      messages: {
        saved: "Członek zespołu zapisany.",
        published: "Opublikowano. Członek jest teraz publiczny.",
        unpublished: "Cofnięto publikację. Członek nie jest już publiczny.",
        reordered: "Kolejność wyświetlania zapisana.",
        deleted: "Członek zespołu usunięty."
      },
      errors: {
        nameRequired: "Wpisz imię i nazwisko członka.",
        unavailable: "Usługa treści nie jest skonfigurowana.",
        loadFailed: "Nie udało się wczytać zespołu.",
        saveFailed: "Nie udało się zapisać członka. Spróbuj ponownie.",
        uploadFailed: "Nie udało się przesłać portretu.",
        notAnImage: "Wybierz obraz PNG, JPEG lub WebP.",
        deleteFailed: "Nie udało się usunąć członka. Spróbuj ponownie."
      },
      deleteDialog: {
        title: "Usunąć tego członka zespołu?",
        message:
          "Spowoduje to trwałe usunięcie członka, jego tłumaczeń i portretu. Tej operacji nie można cofnąć.",
        confirm: "Usuń członka"
      }
    },
    scopes: {
      label: "Twoje uprawnienia",
      pages: "Strony",
      projects: "Projekty",
      publications: "Publikacje",
      documents: "Dokumenty",
      team: "Zespół",
      events: "Wydarzenia",
      media: "Pliki multimedialne",
      importer: "Import treści",
      deniedTitle: "Niedostępne dla Twojej roli",
      deniedMessage:
        "Jesteś zalogowany(-a), ale Twoje uprawnienia administratora nie obejmują tego obszaru. Poproś administratora głównego o ich przyznanie."
    }
  },
  /**
   * T-041 import treści (D-28/D-35). Kody błędów i ostrzeżeń pochodzą z
   * konwertera; tutaj znajdują się wyłącznie zlokalizowane komunikaty.
   */
  import: {
    title: "Import treści",
    description:
      "Zaimportuj plik Markdown lub Word (.docx) i sprawdź przekonwertowaną treść przed publikacją.",
    acceptedFormats: "Akceptowane formaty: Markdown (.md) i Word (.docx).",
    errors: {
      emptyFile: "Wybrany plik jest pusty.",
      fileTooLarge: "Plik jest zbyt duży, aby go zaimportować.",
      invalidSize: "Rozmiar pliku jest nieprawidłowy.",
      invalidFileName: "Nazwa pliku jest nieprawidłowa.",
      unsupportedExtension:
        "Nie można zaimportować tego typu pliku. Użyj Markdown (.md) lub Word (.docx).",
      unsupportedMime:
        "Typ pliku zgłoszony przez przeglądarkę nie jest obsługiwany.",
      mimeExtensionMismatch: "Nazwa pliku i jego typ nie są zgodne.",
      activeContent:
        "Nie można importować aktywnej treści, takiej jak HTML, SVG lub JavaScript.",
      odtDeferred:
        "Format OpenDocument (.odt) nie jest jeszcze obsługiwany. Zapisz dokument jako Word (.docx) w edytorze, a następnie zaimportuj plik .docx.",
      docmRejected:
        "Dokumenty Word z makrami (.docm) nie są akceptowane. Zapisz dokument jako .docx bez makr, a następnie go zaimportuj.",
      docxUnsafeZip:
        "Plik Word jest uszkodzony lub przekracza bezpieczne limity importu.",
      docxMacros:
        "Plik Word zawiera makra, które są niedozwolone. Zapisz go jako .docx bez makr.",
      docxInvalid: "Nie można odczytać pliku Word.",
      emptyDocument: "Plik nie zawiera czytelnej treści.",
      conversionFailed:
        "Nie udało się przekonwertować pliku. Sprawdź plik i spróbuj ponownie.",
      conversionTimeout: "Konwersja trwała zbyt długo i została zatrzymana."
    },
    warnings: {
      rawHtmlDropped: "Surowy HTML został usunięty z Markdown.",
      unsafeLink:
        "Odnośnik z nieobsługiwanym adresem zamieniono na zwykły tekst.",
      remoteImageStripped:
        "Zdalny obraz został usunięty. Prześlij obraz do witryny i wstaw odwołanie do zasobu.",
      imageUnresolved:
        "Nie udało się powiązać obrazu z przesłanym zasobem, więc obraz został usunięty.",
      nestedListFlattened:
        "Zagnieżdżoną listę spłaszczono, aby dopasować ją do formatu czytnika.",
      unsupportedFormatting:
        "Niektóre formatowanie uproszczono na potrzeby czytnika.",
      imageAltMissing:
        "Obraz nie ma tekstu alternatywnego. Dodaj opis przed publikacją.",
      imageUnsupported:
        "Obraz w nieobsługiwanym formacie został usunięty. Użyj PNG, JPEG lub WebP.",
      docxWarning: "Konwersja pliku Word zgłosiła ostrzeżenie."
    }
  },
  notFound: {
    title: "Nie znaleziono strony",
    description: "Żądana strona nie została znaleziona.",
    message: "Żądana strona nie została znaleziona."
  },
  content: {
    updateAvailable: "Dostępna jest aktualizacja.",
    showUpdate: "Pokaż aktualizację",
    updating: "Wczytywanie aktualizacji…",
    loading: "Ładowanie…",
    empty: "Ta strona nie jest dostępna.",
    unavailable: "Ta treść jest tymczasowo niedostępna.",
    fallbackNote: "Ta treść jest dostępna wyłącznie po {language}.",
    fallbackLanguage: "angielsku",
    /* rzad. bierny po „po …" — formy dla języka treści (rev-1 F) */
    fallbackLanguageNames: {
      en: "angielsku",
      pl: "polsku",
      uk: "ukraińsku"
    },
    opensInNewTab: "otwiera się w nowej karcie"
  }
};

export default pl;
