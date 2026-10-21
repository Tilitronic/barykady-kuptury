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
      paragraphSpacing: "Odstęp między akapitami",
      decrease: "Zmniejsz",
      increase: "Zwiększ",
      reset: "Przywróć domyślne",
      resetDone: "Przywrócono domyślne ustawienia czytania."
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
        "Narzędzia zarządzania treścią — projektami, stronami, zespołem, publikacjami i wydarzeniami — pojawią się tutaj w miarę ich gotowości."
    },
    denied: {
      title: "Brak autoryzacji",
      description: "Zalogowane konto nie ma dostępu administracyjnego.",
      heading: "Brak autoryzacji",
      message:
        "Jesteś zalogowany, ale to konto nie ma uprawnień administratora. Poproś organizację o zaproszenie Cię jako administratora albo zaloguj się na inne konto.",
      switchAccount: "Zaloguj się na inne konto"
    }
  },
  notFound: {
    title: "Nie znaleziono strony",
    description: "Żądana strona nie została znaleziona.",
    message: "Żądana strona nie została znaleziona."
  },
  content: {
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
