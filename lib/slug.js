/**
 * Slug helpers used across the app and Convex functions.
 * Keeping these in one place ensures URLs stay consistent
 * whether they're built on the client, the server, or in the database layer.
 */

/**
 * Convert any string into a URL-safe slug.
 * - lowercased
 * - non-alphanumerics collapsed into single hyphens
 * - leading/trailing hyphens stripped
 */
export function slugify(input) {
  if (!input || typeof input !== "string") return "";
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Build a unique event slug by appending a short timestamp suffix.
 * The suffix prevents collisions when two events share the same title.
 */
export function buildEventSlug(title) {
  const base = slugify(title) || "event";
  // Base36 timestamp keeps slugs short while staying unique enough.
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}
