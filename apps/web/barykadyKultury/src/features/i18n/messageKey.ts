import type { MessageSchema } from "@/i18n/en";

type Join<Prefix extends string, Key extends string> = Prefix extends ""
  ? Key
  : `${Prefix}.${Key}`;

/**
 * Recursively flattens the message schema into dot-separated key literals, e.g.
 * `"home.title"`. Used by the typed route-meta helper so a meta entry cannot
 * reference a key the catalogues do not define.
 */
type NestedKeys<Schema, Prefix extends string = ""> = {
  [Key in keyof Schema & string]: Schema[Key] extends Record<string, unknown>
    ? NestedKeys<Schema[Key], Join<Prefix, Key>>
    : Join<Prefix, Key>;
}[keyof Schema & string];

export type MessageKey = NestedKeys<MessageSchema>;
