/**
 * English messages. Master schema for all locales.
 *
 * Only verified organization facts belong here — no placeholder contact
 * details. `MessageSchema` is the compile-time parity contract: the Polish and
 * Ukrainian catalogues annotate themselves with it, so a missing or renamed key
 * fails type-checking (T-009).
 */
const en = {
  app: {
    name: "Barykady Kultury"
  },
  common: {
    skipToContent: "Skip to main content"
  },
  nav: {
    language: "Language"
  },
  theme: {
    toggleLabel: "Toggle dark theme"
  },
  home: {
    title: "Barykady Kultury",
    description: "Official website of the Barykady Kultury association.",
    placeholder: "Website content is being prepared."
  },
  projects: {
    title: "Projects",
    description: "Projects run by the Barykady Kultury association.",
    placeholder: "Projects are being prepared."
  },
  notFound: {
    title: "Page not found",
    description: "The page you requested could not be found.",
    message: "The page you requested could not be found."
  }
};

export type MessageSchema = typeof en;

export default en;
