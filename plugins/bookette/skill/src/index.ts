// The library surface the books-run importer calls (plan task 12.4).
export {
  answerArmsChange,
  batchNamesOf,
  changeProvenance,
  checkOutputs,
  documentArmingSource,
  entitySchedulesFrom,
  inboxNamesOf,
  LEDGER_KEYS,
  LEDGER_OPTIONAL_KEYS,
  optionAnsweredKeysOf,
  scheduleCrossings,
  WEB_VALUE_KEYS,
} from './scripts/check_outputs';
export { EXPORT_ROW_DISPOSITIONS, EXPORT_ROW_WINDOW_DAYS, EXPORT_ROWS_FILE } from './export-rows';
// The sentence a question with no usable prompt is asked in, on every surface that lists it.
export { FALLBACK_QUESTION_SENTENCE } from './question-sentence';
export type { ExportRowDisposition } from './export-rows';
export { exportTableOf, parseCsv, readExportTable } from './export-table';
export type { ExportTable, TableProblem, TableRow } from './export-table';
export { sameDocument } from './scripts/inventory';
export { mergeWebValues } from './web_values';
export type { WebValueMerge } from './web_values';
export type { CheckResult, Problem, ProblemCode, StagedAnswer } from './scripts/check_outputs';
export { answersOf, laterWordCites, unplacesPlacement } from './scripts/check_outputs';
export {
  canonicalValue,
  CodeAppliedError,
  codeAppliedChanges,
  correctionEffectOf,
  correctionGuardedSlots,
  correctionHoldCandidates,
  correctionPairsFor,
  correctionSlots,
  isCodeApplied,
  lineCorrectionEffectOf,
  lineCorrectionPairsFor,
  profileTripsOf,
  TRIP_TRAVEL_LINES,
  tripRegisterChanges,
} from './code-applied';
export type {
  CodeAppliedChange,
  CodeAppliedGuards,
  CodeAppliedRow,
  CodeAppliedRowState,
  CodeAppliedTrip,
  CorrectionPair,
} from './code-applied';
export { fxPriceable } from './scripts/fx';
// The scan double-read's pure seam (issue #1126, decision record 0133): the trigger selection,
// the two readings' comparison and the born-open verify question's shape, shared by both import
// surfaces. The billed second-read call itself lives on the surfaces, never here.
export {
  documentsToSecondRead,
  figuresOfReading,
  verifyReadingKey,
  verifyReadingOfDocument,
} from './verify-reading';
export {
  VERIFY_FIGURE_FIELDS,
  VERIFY_FIRST_READ_OPTION_ID,
  VERIFY_SECOND_READ_OPTION_ID,
} from './verify-reading';
export type {
  VerifyBookedLine,
  VerifyDocument,
  VerifyFigure,
  VerifyFigureField,
  VerifyJudgment,
  VerifyReadingOption,
  VerifyReadingOutcome,
  VerifyReadingQuestion,
} from './verify-reading';
// renderMarkdown is the books.md the build writes; a file-based importer renders the union's with it.
export { buildBooks, renderMarkdown } from './scripts/build_books';
export { stagedMileageBands, withStagedHomeOffice } from './scripts/profile';
export { HOME_ORIGIN_DOCUMENTS } from './scripts/trip_gates';
// The one way from a tax year to its rules directory (issue #989): `rules/ty<year>/`, with a
// typed refusal for a year the skill does not carry; the year is the staged profile.json's.
export { rulesDirOfYear, stagedTaxYear } from './rules-year';
export type { BooksResult } from './scripts/build_books';
// The accountant's workbook (issue #1041): books.xlsx and open-items.md, rendered from the books
// beside renderMarkdown, for the personal tool's folder and the SaaS alike.
export {
  LEDGER_LINE_ENTRY,
  LINES_COLUMNS,
  SETTLED_REASON,
  SETTLED_WORDS,
  WORKBOOK_SHEETS,
  WORKBOOK_WITHHELD,
  WORKBOOK_WORDING_WITHHELD,
  exactCriterion,
  formTitle,
  k1FormOf,
  renderOpenItems,
  renderWorkbook,
  workbookModel,
  workbookName,
  workbookParagraph,
  workbookText,
} from './abacus/workbook';
export type {
  WorkbookCell,
  WorkbookAdviceItem,
  WorkbookDonation,
  WorkbookFinding,
  WorkbookForm,
  WorkbookFormBox,
  WorkbookInputs,
  WorkbookPlacement,
  WorkbookQuestion,
  WorkbookRow,
  WorkbookSheet,
} from './abacus/workbook';
// The open item for a rental with income and no cost document (issue #1468), shared by the report
// and the workbook so the two cannot disagree.
export {
  NO_EXPENSE_DOCUMENTS_TITLE,
  noExpenseDocumentsSentence,
  placedLineOf,
  rentalsWithIncomeAndNoCostDocument,
} from './no-expense-documents';
export type { LiveLine, PlacedEntry, PlacedLine, PlacedPlace } from './no-expense-documents';
// The fx parsers the loader job calls (plan task 10.7), fed by rules/ty<year>/fx/currencies.json.
export { parseH10 } from './scripts/parse_h10';
export type { FxRateRow } from './scripts/parse_h10';
export { parseTreasury } from './scripts/parse_treasury';
export type { FxCurrencyMap, FxCurrencyMapEntry } from './scripts/parse_treasury';
// The currency map's loader (plan task 10.7, ADR 0111 item 4) and the wide-CSV validator the
// reference loader runs over the stored H.10 snapshot before parsing its per-currency series
// (ADR 0111 item 4; a Fed reshape stops the load through its strict series validation).
export { loadFxCurrencyMap } from './scripts/fx_map';
export { vendorH10 } from './scripts/vendor_h10';
export type { VendoredH10 } from './scripts/vendor_h10';
// The fx rate snapshot's bytes (plan task 10.4): the staging freeze builds them, the sandbox's fx
// lookup and the importer's Abacus re-run read them at the one fixed path this names.
export { FX_SNAPSHOT_PATH, buildFxSnapshot, readFxSnapshot } from './scripts/fx_snapshot';
export type { FxSnapshot, FxSnapshotRow } from './scripts/fx_snapshot';
export { assignLedgerIds, assignWorkspaceLedger, idNumber, knownLedgerIds } from './ledger-ids';
// The one ledger-item status vocabulary (issue #314): check_outputs' schema gate and the
// importer's reject both call the predicate, and the pin tests read the list.
export { LEDGER_ITEM_STATUSES, ledgerItemStatus, ledgerItemStatusLabel } from './ledger-status';
export type { LedgerItemStatus } from './ledger-status';
// The one finding-kind vocabulary (issue #613): check_outputs' schema gate and the importer's
// writes both read it, and the pin tests read the list and the labels.
export { FINDING_KINDS, FINDING_KIND_LABELS, findingKindOf } from './finding-kinds';
export { distinctFindingIds } from './distinct-findings';
export type { StoredFinding, StoredFindingCite } from './distinct-findings';
// The run's closing summary (issue #1639): its file, its bound and its shape reader.
export { RUN_SUMMARY_FILE, RUN_SUMMARY_MAX_LENGTH, runSummaryOf } from './run-summary';
export type { FindingKind } from './finding-kinds';
// The question vocabulary (plan task 15.10, ADR 0104): the two kinds, the agent's own key shape, the
// per-run cap and the length limits the checker and the importer share.
export {
  MAX_QUESTIONS_PER_RUN,
  OPEN_QUESTION_KEY_MAX_LENGTH,
  OPEN_QUESTION_KEY_PATTERN,
  OPEN_QUESTION_KEY_PREFIX,
  QUESTION_KINDS,
  QUESTION_PROMPT_MAX_LENGTH,
  QUESTION_HELP_MAX_LENGTH,
  questionHelpOf,
  TEXT_ANSWER_MAX_LENGTH,
  UNASSIGNED_LINE_ENTITY_KEY,
  askedQuestionCount,
  isOpenQuestionKey,
  PLACED_GROUP_TITLE,
  PLACED_SINCE_MOVED,
  placedEntityIdOf,
  placedLine,
  placedOptionOf,
  stillPlacedOn,
  questionDisplayStrings,
  questionKindOfKey,
  stagedEntityNames,
} from './question-keys';
export type { QuestionKind } from './question-keys';
// The review mode (issue #1384, decision record 0150): the file the worker stages into every run
// and the reader the start stage and check_outputs share.
export { REVIEW_MODE_FILE, reviewFileBody, reviewModeOf } from './review-mode';
export type { ReviewMode } from './review-mode';
export { endedMonthWords } from './ended-month';
export { parseDec, toCents, fmtCents, readingTotalCents } from './money';
// One ledger line's amount as a screen or a prompt prints it (issue #329): the Review screen's
// wording for a line in its own currency.
export { lineAmountText } from './line-amount';
export { bannedPolicyPhrases } from './scan';
export { policyFilePhrases } from './policy-file';
// The closed vehicle-method vocabulary (issue #110): check_outputs' profile gate reads it, and
// the report's stored vehicle rows carry one of these words or null.
export { VEHICLE_METHODS } from './vehicle-methods';
export type { VehicleMethod } from './vehicle-methods';
// The words every comparison surface prints for a day trip and a vehicle's miles (task 37.8).
export {
  ACTUAL_COST_STEP_LABEL,
  DAY_TRIP_NOTE,
  DAY_TRIP_PER_DIEM,
  MILES_SOURCES,
  milesSourceWords,
  parseVehicleBandStep,
  parseVehicleStep,
  splitVehicleTripStep,
  vehicleActualCostStep,
  vehicleBandStep,
  vehicleLineStep,
} from './comparison-words';
export type { MilesFacts, MilesSource, VehicleBand, VehicleStep } from './comparison-words';
export { vehicleMilesWords, vehicleUseEntities } from './abacus/vehicles';
// The closed home-office vocabularies (issue #661): the cost kinds and uses a staged home cost
// carries. check_outputs' gates read them and the importer refuses a word outside them.
export { HOME_COST_KINDS, HOME_COST_USES } from './home-office';
export type { HomeCostKind, HomeCostUse } from './home-office';
// The home-office readings (issue #661): the importer's pre-claim gates call the one function
// Abacus and check_outputs compute them with.
export {
  atMostTwoDecimals,
  homeAreaWithinColumn,
  homeOfficeReadings,
  loadHomeOfficeReadings,
} from './scripts/home_office';
export type { HomeOfficeResult } from './scripts/home_office';
// The capital-cost comparisons' closed vocabularies (issue #691): check_outputs' profile gate
// reads the asset kinds, and the importer refuses a stored word outside the conventions, the
// missing inputs and the passed limits.
export {
  ASSET_KINDS,
  CAPITAL_CONVENTIONS,
  CAPITAL_MISSING,
  EXPENSE_LIMITS,
  LEDGER_TAGS,
  assetKindOf,
} from './capital-costs';
export type {
  AssetKind,
  CapitalConvention,
  CapitalMissing,
  ExpenseLimit,
  LedgerTag,
} from './capital-costs';
// Parcel-number normalization (issue #110): Abacus resolves the parcel split through it and the
// importer's parcel staging must fold spellings the same way.
export { normalizeParcel } from './parcels';
export { READER_DOCUMENT_INSTRUCTIONS } from './reader-document';
export { printedAddressesOf, readingAddressesOf } from './reading-addresses';
export type { ReadingAddress } from './reading-addresses';
// The tax-year forms check_outputs dates on the year's last day; the reader's dateless-form list
// (`@bookette/reader/review-bucket`, which may import nothing) is pinned to it by its spec.
export { YEAR_FORM_DOC_TYPES } from './document-status';
// The version stamps every books run carries (plan task 11.1): the worker stamps them onto the
// run row and the out/ envelope, and the importer's gate compares them against its own copy.
export { OUTPUT_SCHEMA_VERSION, versions, versionsOf } from './versions';
export type { BooksVersions } from './versions';
// The platform payout-statement figures (epic #1017, issues #1106 and #1107): the read job's
// pre-reserve match, the staged reading's block, and the one figure function the agent's script
// and the output gate both run — arithmetic here, never a model estimate (0019 item 1, 0033) —
// beside the pure net-reconciliation, anchor and 1099-K coverage checks the Report recomputes.
export {
  anchorStatements,
  computeStatementFigures,
  coverForm1099K,
  loadStatementDocuments,
  mappedStatementBlock,
  matchStatementDocument,
  parseStatementGrid,
  reconcileStatement,
  statementBlockOf,
  statementDocumentOf,
  statementFilesFromParsed,
  statementHeaderCandidates,
  statementHeaderCandidatesOf,
  statementMatchOf,
  supersetStatementReading,
} from './platform-statements';
export type {
  BookedLineCandidate,
  Form1099KCoverageRow,
  Form1099KReading,
  StatementAnchor,
  StatementAnchorOutcome,
  StatementBlock,
  StatementColumn,
  StatementDocument,
  StatementExtractionFigures,
  StatementFigure,
  StatementFigureProblem,
  StatementFiguresResult,
  StatementFile,
  StatementGrid,
  StatementHeaderCandidate,
  StatementHeaderMapping,
  StatementHeaderRefusal,
  StatementReconcile,
  StatementReconcileOutcome,
  StatementReconcileReason,
  StatementReconcileTerm,
  StatementReference,
  StatementRows,
} from './platform-statements';
