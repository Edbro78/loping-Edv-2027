export type ArticleBlock =
  | { type: 'h2'; text: string }
  | { type: 'p'; text: string }
  | { type: 'pull'; text: string }
  | { type: 'help'; text: string };

export type ArticleDoc = {
  kicker: string;
  h1: string;
  lead: string;
  homeToolLink?: string;
  homeToolTo?: string;
  blocks: ArticleBlock[];
  adSlots?: string[];
};
