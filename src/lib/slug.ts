/** GE6 member page slug, e.g. "Pancake BNK48" → "pancake-bnk48" (same rule as scripts/build-ge6-results.mjs). */
export const memberSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
