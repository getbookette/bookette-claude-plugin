---
name: demo
description: Fill this empty folder with Bookette's synthetic demo tax year, then review it. Run only when the person types /bookette:demo.
disable-model-invocation: true
---

Make this folder Bookette's demo: a complete synthetic tax-year folder whose books are already kept, so the person sees what Bookette does before adding their own files. Every document in it is made up, and no model is called to make it.

1. When no bookette tool is available, the Bookette server did not start: tell the person it needs Node.js 24 or later (on macOS `brew install node`, on Linux the installer at https://nodejs.org/en/download), that its first start downloads it and can take a minute, and to run `/mcp` to reconnect. Stop there.
2. Call `bookette_status`. When it reports `initialized: true`, say this folder is already a Bookette folder and stop. When the result carries no `demoCommand`, say the demo needs an empty folder, one not under a folder whose name starts with a dot and not inside another Bookette folder, and stop.
3. Run the result's `demoCommand` exactly as given, as one Bash command, nothing added. When it fails, tell the person what it printed and stop.
4. Say once that every document in the folder is synthetic. Call `bookette_status` again, then start the review as the bookette skill's section 3 describes: call `bookette_review` and put its open questions to the person.
