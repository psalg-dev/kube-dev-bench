Project `impl` summary

Files:
- `generate_summary.js` — Node script that scans `project/impl/work` for `*.plan.md` files and writes `summary.html`.
- `summary.html` — generated HTML summary. Run the script to update.

Usage:

```sh
# from repository root
node project/impl/generate_summary.js
```

The agent will run this script upon a user-requested `sync` to refresh `summary.html`.
