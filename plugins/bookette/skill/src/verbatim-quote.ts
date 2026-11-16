/** A pointer's quote checked against the text it names (issue #1591): copied verbatim, case and
 *  runs of white space aside, from one of the source's strings. */
export const verbatimFold = (text: string): string =>
  text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

export function quotedIn(sources: readonly string[], quote: string): boolean {
  const wanted = verbatimFold(quote);
  return wanted !== '' && sources.some((text) => verbatimFold(text).includes(wanted));
}
