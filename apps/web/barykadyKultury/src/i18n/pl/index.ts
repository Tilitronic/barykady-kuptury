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
  nav: {
    language: "Język",
    openMenu: "Otwórz menu nawigacji",
    closeMenu: "Zamknij menu nawigacji",
    mainNav: "Nawigacja główna",
    contact: "Kontakt",
    about: "O nas",
    support: "Wesprzyj nas",
    projects: "Projekty",
    events: "Wydarzenia",
    publications: "Publikacje",
    aboutOrg: "Organizacja",
    team: "Zespół",
    documents: "Dokumenty"
  },
  footer: {
    nav: "Nawigacja stopki",
    privacyPolicy: "Polityka prywatności",
    socialNav: "Media społecznościowe"
  },
  theme: {
    darkMode: "Tryb ciemny"
  },
  home: {
    title: "Barykady Kultury",
    description: "Oficjalna strona stowarzyszenia Barykady Kultury.",
    placeholder: "Treść strony jest w przygotowaniu."
  },
  contact: {
    title: "Kontakt",
    description: "Dane kontaktowe Barykad Kultury.",
    notConfigured: "Dane kontaktowe nie zostały jeszcze opublikowane.",
    guidance:
      "W międzyczasie możesz dowiedzieć się więcej o nas lub znaleźć sposoby wsparcia:",
    emailSubject: "Wiadomość ze strony internetowej",
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
      languageLabel: "Język dokumentu",
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
    detail: {
      back: "Powrót do projektów"
    },
    status: {
      published: "Opublikowany",
      draft: "Szkic",
      archived: "Zarchiwizowany"
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
    opensInNewTab: "otwiera się w nowej karcie"
  }
};

export default pl;
