# Bookette

Bookette keeps a tax-year folder's books in your own Claude Code session. It serves 1099
workers, landlords and short-term rental hosts, turning receipts, bank and card statements,
1099s and K-1s into books with Schedule C and Schedule E categories for your accountant.

The plugin loads the Bookette books skill, a /bookette:demo skill that fills an empty folder
with a synthetic demo year when you type it, and the bookette_* MCP tools over stdio. The
books skill stages receipts and statements and asks the review questions; the tools read,
answer, record and export for the accountant, and an export goes to a file you name. Every
import passes Bookette's checks. Every figure comes from Bookette's deterministic calculation
code, never from a model.

Your books and files stay in the tax-year folder on your machine, and Bookette receives
nothing. Inside your tax-year folder, hooks confine each tool call and record your turns. The
model work is your own Claude Code session's, so it processes what it reads under Claude Code's
own terms. The plugin carries its own code and downloads nothing itself; during a run the
session may fetch https pages on federal .gov domains: the plugin's confinement allows at most
eight URLs a run and logs each in the folder's fetch log as a hash line. No Social Security
number is stored as a data field.

Bookette also runs as a web app at https://getbookette.com for people who keep their books without Claude Code.
