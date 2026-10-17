import en from "./en";
import pl from "./pl";
import uk from "./uk";

/**
 * All message catalogues keyed by locale. `en` is the master schema; `pl` and
 * `uk` are annotated with `MessageSchema` in their own modules.
 */
const messages = {
  en,
  pl,
  uk
};

export type { MessageSchema } from "./en";

export default messages;
