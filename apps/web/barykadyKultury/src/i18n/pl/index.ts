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
    toggleLabel: "Przełącz tryb ciemny"
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
    placeholder: "Opcje wsparcia są w przygotowaniu."
  },
  events: {
    title: "Wydarzenia",
    description: "Nadchodzące wydarzenia organizowane przez Barykady Kultury.",
    placeholder: "Wydarzenia są w przygotowaniu."
  },
  publications: {
    title: "Publikacje",
    description: "Publikacje Barykad Kultury.",
    placeholder: "Publikacje są w przygotowaniu."
  },
  projects: {
    title: "Projekty",
    description: "Projekty realizowane przez stowarzyszenie Barykady Kultury.",
    placeholder: "Projekty są w przygotowaniu."
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
