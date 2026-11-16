// The scan double-read's pure seam (issue #1126, decision record 0133): which documents get the
// one fresh-context second transcription, how the two readings compare, and the born-open
// `verify_reading:` question a disagreement or a low score mints. This module is everything of
// the feature the books skill carries — the trigger selection, the comparison and the question's
// shape — as pure functions over plain data, so the two import surfaces (the worker's import job
// and the personal tool's folder import) each hand it their own readings, book their one billed
// call themselves and write the question this module shapes. Nothing here imports the model
// client and the skill's dependency set does not grow; both surfaces share this one extraction
// and one comparison, so they cannot disagree about what "differs" means.

import { VERIFY_READING_KEY_PREFIX, parseEffect } from './effects';
import { fmtCents, readingTotalCents } from './money';

/** The reader contract's key fields that carry figures: what the second read transcribes and
 *  what the comparison judges. `vendor_or_payer` and `document_date` are key fields too, but a
 *  misread name or date is not a figure booked silently — the person sees both on the card — so
 *  they stay outside this family. */
export const VERIFY_FIGURE_FIELDS = ['total', 'form_boxes', 'transactions'] as const;
export type VerifyFigureField = (typeof VERIFY_FIGURE_FIELDS)[number];

/** One figure of one reading as the seam sees it: the amount as the document prints it (the
 *  reader's decimal string, parentheses for a negative) and whether the field's confidence is
 *  `low` — the reader said it chose between two readings or part of the value was illegible. */
export interface VerifyFigure {
  readonly field: VerifyFigureField;
  /** Where the figure sits in the reading: null for a document total, the box number for a form
   *  box, the 1-based row position for a statement transaction. The slot is how the two readings
   *  of one document are matched figure to figure. */
  readonly slot: string | null;
  readonly amount: string;
  readonly low: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A box map's amount (box number to decimal string) and a transaction row's amount, as the
// reader's schema carries them; anything else is unreadable and yields no figure, which the
// comparison then reads as the second read having failed to produce the figure.
function figureAmountOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Every figure of one reading (the reader's whole answer: the `extractions.fields` column, the
 * same `fields` a run's `documents.json` entry carries), with the field confidence beside it —
 * the `field_confidence` column on the SaaS, the entry's `confidence` map in documents.json. A
 * field the reading left empty yields no figure (nothing booked from it); every present figure
 * of the three fields does, its `low` the field's whole score. A malformed payload is a reading
 * with no figures, never a throw: the caller's import must survive any stored bytes.
 */
export function figuresOfReading(fields: unknown, confidence: unknown): VerifyFigure[] {
  const figures: VerifyFigure[] = [];
  if (!isRecord(fields)) return figures;
  const scores = isRecord(confidence) ? confidence : {};
  const lowOf = (field: VerifyFigureField): boolean => scores[field] === 'low';
  const total = figureAmountOf(fields['total']);
  if (total !== null) {
    figures.push({ field: 'total', slot: null, amount: total, low: lowOf('total') });
  }
  const boxes = fields['form_boxes'];
  if (isRecord(boxes)) {
    for (const slot of Object.keys(boxes).sort()) {
      const amount = figureAmountOf(boxes[slot]);
      if (amount !== null) {
        figures.push({ field: 'form_boxes', slot, amount, low: lowOf('form_boxes') });
      }
    }
  }
  const rows = fields['transactions'];
  if (Array.isArray(rows)) {
    rows.forEach((row, index) => {
      const amount = isRecord(row) ? figureAmountOf(row['amount']) : null;
      if (amount !== null) {
        figures.push({
          field: 'transactions',
          slot: String(index + 1),
          amount,
          low: lowOf('transactions'),
        });
      }
    });
  }
  return figures;
}

/** A booked line resting on a document, as the trigger reads it: its ledger id and its booked
 *  amount as the ledger prints it (the run's `ledger.json` shape, a decimal string). */
export interface VerifyBookedLine {
  readonly ledgerId: string;
  readonly amount: string;
}

/** One document of the pass's input, as each surface knows it: the document's key and cite
 *  tokens, its gated display label, whether it has no text layer (the per-surface fact — the
 *  SaaS parse store's page kinds, the folder inventory's null first lines), its first reading's
 *  figures, the currency the reading printed, and the lines booked from it. */
export interface VerifyDocument {
  /** The key's document word, `doc_<n>`: the staged reading's token both surfaces carry. */
  readonly docId: string;
  /** The document cite as the surface resolves citations: the staged file token or inbox path. */
  readonly documentCite: string;
  /** The document's label as the person has seen it; the caller gates it before it lands here. */
  readonly label: string;
  /** No text layer: a scan or photograph, the class the second read exists for. */
  readonly noTextLayer: boolean;
  /** The reading's own currency word (three uppercase letters), or null when it printed none;
   *  the correcting option's amounts are in it, as `line_correction` requires. */
  readonly currency: string | null;
  readonly figures: readonly VerifyFigure[];
  readonly bookedLines: readonly VerifyBookedLine[];
}

/** One judged figure: the two readings and whether the second read bore the first out. `second`
 *  is null when the second read produced nothing comparable at the slot (its own parse failed,
 *  or the figure is gone) — a missing second reading is a disagreement, never a pass. Both
 *  readings are carried in canonical cents form (`fmtCents`), the prompt's wording and, on the
 *  correcting arm, the correction effect's `from` and `to`. */
export interface VerifyJudgment {
  readonly field: VerifyFigureField;
  readonly slot: string | null;
  readonly first: string;
  readonly second: string | null;
  readonly agree: boolean;
  /** The first read's field confidence was low: the figure asks without waiting for a
   *  disagreement. */
  readonly low: boolean;
  /** The one booked line whose amount the first reading is, when exactly one line took it; null
   *  when no line took the figure or several carry the same amount (the books cannot say which
   *  line the figure booked). */
  readonly line: string | null;
}

/** The outcome for one document: agreement (every figure stands, the double-read is recorded
 *  beside the reading) or the born-open question to mint. */
export type VerifyReadingOutcome =
  | { readonly kind: 'agree'; readonly docId: string }
  | {
      readonly kind: 'mint';
      readonly docId: string;
      readonly judgments: readonly VerifyJudgment[];
      readonly question: VerifyReadingQuestion;
    };

/** The born-open question, in the shape both importers write: the code-owned key, the code
 *  prompt (the readings are figures the document itself prints — code copy over a printed
 *  document, never model text), the cites (the booked line the correcting option applies to and
 *  the document cite for the card's chip — the stored answer's cites carry only the line ids,
 *  which is what the correction walk reads), and the options. */
export interface VerifyReadingQuestion {
  readonly key: string;
  readonly prompt: string;
  readonly cites: readonly string[];
  readonly options: readonly VerifyReadingOption[];
}

export interface VerifyReadingOption {
  readonly id: string;
  readonly label: string;
  readonly effect: unknown;
}

export const VERIFY_FIRST_READ_OPTION_ID = 'first_read';
export const VERIFY_SECOND_READ_OPTION_ID = 'second_read';

const FIRST_READ_LABEL = 'Keep the figure as first read';
const SECOND_READ_LABEL = 'Use the second read\u2019s figure';

// The route sentence the mint appends, chosen by the question's shape (issue #1918): the
// correcting arm keeps its two-option wording; a confirmation-only card says why no
// `second_read` option exists where the shape names a reason \u2014 several figures need the
// person one line at a time, or no single booked line took the figure \u2014 and every other
// shape (the second read found nothing, a low read the second bore out, an effect past the
// correction ceiling) keeps the plain sentence, now true because the card carries the
// per-line correction itself.
const CORRECTING_ROUTE = ' Keep the first read, or take the second.';
const SEVERAL_FIGURES_ROUTE =
  ' Keep the figures, or correct each line from this card \u2014 one answer cannot carry corrections for several figures.';
const NO_SINGLE_LINE_ROUTE =
  ' Keep the figure, or correct the line from this card \u2014 no single booked line took this figure.';
const PLAIN_ROUTE = ' Keep the figure, or correct the line from this card.';

// The question prompt is stored text (the SaaS column CHECK and the registry's rendering both
// bound it at 300), so the composition is bounded part by part rather than truncated after the
// fact: a cut mid-figure could print a wrong number, and a wrong number is the defect class
// this feature exists to close.
const PROMPT_MAX_LENGTH = 300;
const PROMPT_LABEL_MAX = 60;
const PROMPT_FIGURES_MAX = 3;

/** The key of a document's verify question: one live key per document. */
export function verifyReadingKey(docId: string): string {
  return `${VERIFY_READING_KEY_PREFIX}${docId}`;
}

/**
 * The documents the pass must second-read: the scan/photo-sourced documents whose lines the
 * ledger books — a document nothing booked from keeps today's path, whatever its scores. The
 * caller composes each document's figures and booked lines from its own stores (the run's
 * `documents.json` and ledger on both surfaces); this is the one rule both surfaces share for
 * who is in, so the billed pass is bounded the same way twice.
 */
export function documentsToSecondRead<T extends VerifyDocument>(documents: readonly T[]): T[] {
  return documents.filter((document) => document.noTextLayer && document.bookedLines.length > 0);
}

/** The one booked line whose amount the figure's first reading is, or null. */
function matchedLine(first: string, bookedLines: readonly VerifyBookedLine[]): string | null {
  const cents = readingTotalCents(first);
  if (cents === null) return null;
  const taken = bookedLines.filter((line) => readingTotalCents(line.amount) === cents);
  return taken.length === 1 ? (taken[0]?.ledgerId ?? null) : null;
}

function slotWords(judgment: VerifyJudgment): string {
  if (judgment.field === 'total') return 'the total';
  if (judgment.field === 'form_boxes') return `a form box ${judgment.slot ?? '?'}`;
  return `a transaction amount (row ${judgment.slot ?? '?'})`;
}

/**
 * The pass's whole comparison and mint for one document: the first reading's figures, the second
 * read's figures (the fresh transcription the surface's one billed call brought back) and the
 * document's booked lines. A figure is judged — and the document mints — when the second read
 * disagrees with it, or its field scored low whether or not the second read agreed; a document
 * with no judged figure agrees, and its double-read is recorded.
 *
 * The question's options by what the corrections can carry: when exactly one figure needs the
 * person, the second read read it differently, and exactly one booked line took the first
 * reading's value, the `second_read` option carries that line's correction as a `line_correction`
 * effect (0104's correction-effect family, validated at mint by `parseEffect` like every stored
 * payload) and the next imported run applies it on the code-applied path, exactly as a
 * `correct_line:` answer lands. Every other shape — a low read the second read bore out (nothing
 * to carry), a figure no line demonstrably took, or several figures needing the person (one
 * option carries one correction, and a half-correction would book the rest silently) — asks with
 * the confirmation option alone, its prompt's route saying why no `second_read` option exists
 * where the shape names a reason, and routes the correction to the person-driven `correct_line:`
 * affordance the verify card itself carries. No option is ever inert, and
 * the question allows no free text anywhere.
 */
export function verifyReadingOfDocument(input: {
  readonly document: VerifyDocument;
  /** The second read's figures: the fresh transcription of the same document's figure fields. */
  readonly secondFigures: readonly VerifyFigure[];
}): VerifyReadingOutcome {
  const { document } = input;
  const secondBySlot = new Map(
    input.secondFigures.map((figure) => [`${figure.field}\u0000${figure.slot ?? ''}`, figure]),
  );
  const judgments: VerifyJudgment[] = [];
  for (const figure of document.figures) {
    const second = secondBySlot.get(`${figure.field}\u0000${figure.slot ?? ''}`);
    const firstCents = readingTotalCents(figure.amount);
    const secondCents = second === undefined ? null : readingTotalCents(second.amount);
    const first = firstCents === null ? figure.amount : fmtCents(firstCents);
    const agree = firstCents !== null && firstCents === secondCents;
    if (figure.low || !agree) {
      judgments.push({
        field: figure.field,
        slot: figure.slot,
        first,
        second: secondCents === null ? null : fmtCents(secondCents),
        agree,
        low: figure.low,
        line: matchedLine(first, document.bookedLines),
      });
    }
  }
  if (judgments.length === 0) return { kind: 'agree', docId: document.docId };
  // The correcting arm: one judged figure, a second reading that read it differently, one line
  // that demonstrably took the first reading's value, both readings inside the correction's
  // canonical shape. Anything else takes the confirmation-only shape.
  const [only] = judgments;
  const correcting =
    judgments.length === 1 &&
    only !== undefined &&
    !only.agree &&
    only.second !== null &&
    only.line !== null
      ? only
      : null;
  const options: VerifyReadingOption[] = [
    { id: VERIFY_FIRST_READ_OPTION_ID, label: FIRST_READ_LABEL, effect: { kind: 'none' } },
  ];
  if (correcting !== null && correcting.second !== null && correcting.line !== null) {
    const effect = {
      kind: 'line_correction',
      currency: document.currency ?? 'USD',
      amount: { from: correcting.first, to: correcting.second },
    };
    // The mint validates the effect like every stored payload: outside the canonical shape (a
    // figure past the correction ceiling), the option is dropped and the question keeps the
    // confirmation-only shape — never a malformed effect on a stored row.
    if (parseEffect(effect) !== null) {
      options.push({ id: VERIFY_SECOND_READ_OPTION_ID, label: SECOND_READ_LABEL, effect });
    }
  }
  return {
    kind: 'mint',
    docId: document.docId,
    judgments,
    question: {
      key: verifyReadingKey(document.docId),
      prompt: verifyReadingPrompt(document.label, judgments, routeOf(options, judgments)),
      cites:
        correcting !== null && correcting.line !== null
          ? [correcting.line, document.documentCite]
          : [document.documentCite],
      options,
    },
  };
}

/** The route the mint's shape names: the option count keys the correcting arm \u2014 the same
 *  count the web reads to draw the line-correction disclosure (issue #1918) \u2014 and a
 *  confirmation-only card of one differing figure no booked line demonstrably took says so;
 *  every other confirmation-only shape keeps the plain sentence. */
function routeOf(
  options: readonly VerifyReadingOption[],
  judgments: readonly VerifyJudgment[],
): string {
  if (options.length > 1) return CORRECTING_ROUTE;
  const [only] = judgments;
  if (judgments.length > 1 || only === undefined) return SEVERAL_FIGURES_ROUTE;
  if (!only.agree && only.second !== null && only.line === null) return NO_SINGLE_LINE_ROUTE;
  return PLAIN_ROUTE;
}

/** One sentence's capitalized opening: a slot word is lowercase mid-sentence and heads its own
 *  sentence in the prompt. */
const capitalized = (sentence: string): string =>
  `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;

/** The prompt: the code sentence naming the document, then each judged figure its own
 *  capitalized sentence — or, for a figure the second read bore out, the low flag it asks on —
 *  and the route the mint chose from the shape, bounded to the stored prompt's 300 characters by
 *  construction: the label is capped and at most three figures are listed — a fourth judged
 *  figure overflows the bound by construction (a three-figure listing beside the longest route
 *  sits at 290–293, and the count word a fourth would owe takes any of them past 300),
 *  so the composition names the card instead of printing a cut figure. */
function verifyReadingPrompt(
  label: string,
  judgments: readonly VerifyJudgment[],
  route: string,
): string {
  const head = `A second read of \u201c${label.slice(0, PROMPT_LABEL_MAX)}\u201d needs a look.`;
  const sentences = judgments.slice(0, PROMPT_FIGURES_MAX).map((judgment) => {
    if (judgment.agree) {
      return `${capitalized(slotWords(judgment))}: both reads show ${judgment.first}, read at low confidence`;
    }
    const second =
      judgment.second === null ? 'not found on the second read' : `second read ${judgment.second}`;
    return `${capitalized(slotWords(judgment))}: first read ${judgment.first}, ${second}`;
  });
  const body = `${sentences.join('. ')}.`;
  const full = `${head} ${body}${route}`;
  // The count word a fourth figure would owe never fits, so the bound carries the count itself:
  // a fourth judged figure names the card rather than a listing of three of four.
  if (judgments.length > PROMPT_FIGURES_MAX || full.length > PROMPT_MAX_LENGTH) {
    return `${head} Review the figures beside this card.${route}`;
  }
  return full;
}
