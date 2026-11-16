// The fields a place's declaration and an answer carry on both the chat's tools and the personal
// tool's MCP tools (task 37.2, issue #1369): `propose_entity` and `bookette_declare_place` share a
// place's name, address, other names and listings, and `propose_answer` and `bookette_answer` an
// answer's question key and option id. Each side spreads these with its own `.describe()`, which
// returns a described copy and leaves the shape here untouched, and its own `.optional()`, so each
// side's schema keeps its own words and its own required fields. The shapes carry the types only:
// the length and count limits stay in `validateDeclaredEntity` (declared-entity.ts), which both
// sides call, so a refused value is still that validator's typed refusal and is measured after
// its trim. packages/config/test/shared-shapes.spec.ts fails a field carried on one side only.
// A sibling of declared-entity.ts, not part of it, so the sandbox's checker, which imports that
// module, does not load zod.

import { z } from 'zod';

/** A place's declared fields, as both declaring tools carry them. */
export const PLACE_FIELDS = {
  name: z.string(),
  address: z.string(),
  aliases: z.array(z.string()),
  listings: z.array(z.string()),
} as const;

/** An answer's two fields, as both answering tools carry them. */
export const ANSWER_FIELDS = {
  questionKey: z.string(),
  optionId: z.string(),
} as const;
