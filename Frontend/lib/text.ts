/** 'under_repair' -> 'Under repair'. Rewords a stored status or condition for display; never use CSS `capitalize` for this, it upper-cases every word of a name too. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const words = value.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
