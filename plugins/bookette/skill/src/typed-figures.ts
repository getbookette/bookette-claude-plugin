/**
 * The amounts, calendar days and place names a person's typed answer prints (decision records
 * 0161 and 0167). The checker reads them to tell whether a property's purchase recorded from a
 * typed `purchase` answer carries the person's own figures, whether lines placed from a typed
 * `placement` answer sit on the one place the text names, and whether a follow-up only repeats
 * either. It never decides what the words mean: that is the run's reading, and a figure or a place
 * the text does not print is refused.
 */
import { isValidDay } from './dates';

export interface TypedFigures {
  /** Every amount the text prints, in cents: `$334,000.00`, `334,000`, `60000`. */
  readonly cents: ReadonlySet<number>;
  /** Every calendar day the text prints, as `YYYY-MM-DD`. */
  readonly days: ReadonlySet<string>;
}

const MONTH =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ORDINAL = '(?:st|nd|rd|th)?';

/** Where a day shape's year sits in the match: a group printing four digits, or one printing two,
 *  read on a fixed pivot (`00`–`49` as 2000–2049, `50`–`99` as 1950–1999) so the parse never
 *  depends on the clock and `6/15/98` is a 1998 purchase, not a 2098 one. A day typed with no year
 *  names none (`June 15`): it cannot anchor a purchase's year, so the run asks rather than the
 *  checker assuming one. */
type YearSource = { readonly fullYear: number } | { readonly twoDigitYear: number };

/** Two-digit years below this read as 20xx, the rest as 19xx. */
const TWO_DIGIT_YEAR_PIVOT = 50;

/** Each day shape the person may type, with where its year, month and day sit in the match. */
const DAY_SHAPES: readonly { pattern: RegExp; year: YearSource; month: number; day: number }[] = [
  { pattern: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, year: { fullYear: 1 }, month: 2, day: 3 },
  { pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, year: { fullYear: 3 }, month: 1, day: 2 },
  { pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{2})\b/g, year: { twoDigitYear: 3 }, month: 1, day: 2 },
  {
    pattern: new RegExp(`\\b${MONTH}\\s+(\\d{1,2})${ORDINAL},?\\s+(\\d{4})\\b`, 'gi'),
    year: { fullYear: 3 },
    month: 1,
    day: 2,
  },
  {
    pattern: new RegExp(`\\b(\\d{1,2})${ORDINAL}\\s+(?:of\\s+)?${MONTH},?\\s+(\\d{4})\\b`, 'gi'),
    year: { fullYear: 3 },
    month: 2,
    day: 1,
  },
];

/** An amount: digits grouped by commas or not, optional cents, not inside a longer number. */
const AMOUNT = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d{1,13})(?:\.(\d{2}))?(?![\d]|[.,]\d)/g;

function monthNumber(word: string): number {
  return /^\d+$/.test(word)
    ? Number(word)
    : MONTHS.indexOf(word.toLowerCase().replace(/\.$/, '').slice(0, 3)) + 1;
}

function yearOf(source: YearSource, match: readonly string[]): string {
  if (!('twoDigitYear' in source)) return match[source.fullYear] ?? '';
  const two = match[source.twoDigitYear] ?? '';
  return `${Number(two) < TWO_DIGIT_YEAR_PIVOT ? '20' : '19'}${two}`;
}

function isoDay(year: string, month: number, day: string): string {
  return `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function typedFigures(text: string): TypedFigures {
  const days = new Set<string>();
  let rest = text;
  for (const shape of DAY_SHAPES) {
    rest = rest.replace(shape.pattern, (...match: string[]) => {
      const day = isoDay(
        yearOf(shape.year, match),
        monthNumber(match[shape.month] ?? ''),
        match[shape.day] ?? '',
      );
      if (isValidDay(day)) days.add(day);
      // A day's digits are no amount.
      return ' ';
    });
  }
  const cents = new Set<number>();
  for (const match of rest.matchAll(AMOUNT)) {
    const whole = Number((match[1] ?? '').replace(/,/g, ''));
    cents.add(whole * 100 + Number(match[2] ?? '0'));
  }
  return { cents, days };
}

/** A property's purchase as a typed answer may state it: the price paid, the land value and
 *  the first-rented day. */
export interface PurchaseFigures {
  readonly costBasisCents: number;
  readonly landValueCents: number;
  readonly placedInService: string;
}

/** Whether the text prints all three of a purchase's figures. */
export function statesPurchase(figures: TypedFigures, purchase: PurchaseFigures): boolean {
  return (
    figures.cents.has(purchase.costBasisCents) &&
    figures.cents.has(purchase.landValueCents) &&
    figures.days.has(purchase.placedInService)
  );
}

/** A place the text may name: its profile key and the names it goes by. */
export interface NamedPlace {
  readonly key: string;
  readonly names: readonly string[];
}

function spaced(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** The keys of the places whose name the text prints whole, ignoring case and spacing: "915
 *  Saltgrass Bend's" names 915 Saltgrass Bend, "the Saltgrass house" names nothing. */
export function placesNamed(text: string, places: readonly NamedPlace[]): string[] {
  const words = spaced(text);
  return places
    .filter((place) =>
      place.names.some((name) => {
        const wanted = spaced(name);
        if (wanted === '') return false;
        const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(words);
      }),
    )
    .map((place) => place.key);
}
