"""
Unit tests without Node.js.

Each tests/*.test.ts file exports `tests: { name: string; run: () => void | Promise<void> }[]`.
The files and the src modules they import are transpiled by the TypeScript compiler
inside headless Chrome/Edge and run as real ES modules. Test files may only import
project modules without bare package imports (no 'react'), which keeps the
contact rules, content model and Worker handler testable.

Usage:
  uv run --no-project --python 3.12 python tests/run_tests.py
Exit code 0 = all tests passed.
"""

import sys

from tslib import as_json_payload, find_cache, project_sources, run_in_browser, typescript_js

RUNNER_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>AG tests</title>
<script src="/typescript.js"></script></head><body><script>
(async () => {
  const results = [];
  try {
    const files = await (await fetch('/files.json')).json();
    const urls = new Map();
    const resolve = (from, spec) => {
      const parts = from.split('/').slice(0, -1);
      for (const seg of spec.split('/')) {
        if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg);
      }
      return parts.join('/');
    };
    const load = async (path) => {
      if (urls.has(path)) return urls.get(path);
      const source = files[path];
      if (source === undefined) throw new Error('Cannot find module ' + path);
      let js = ts.transpileModule(source, {
        fileName: path,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: false },
      }).outputText;
      const specs = [...js.matchAll(/(?:from|import)\\s*['"](\\.{1,2}\\/[^'"]+)['"]/g)].map(m => m[1]);
      for (const spec of new Set(specs)) {
        const url = await load(resolve(path, spec));
        js = js.split("'" + spec + "'").join("'" + url + "'").split('"' + spec + '"').join('"' + url + '"');
      }
      const url = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }));
      urls.set(path, url);
      return url;
    };
    const testFiles = Object.keys(files).filter(f => f.startsWith('/tests/') && f.endsWith('.test.ts')).sort();
    for (const file of testFiles) {
      const mod = await import(await load(file));
      for (const t of mod.tests || []) {
        try { await t.run(); results.push({ file, name: t.name, ok: true }); }
        catch (err) { results.push({ file, name: t.name, ok: false, error: String(err && err.message || err) }); }
      }
    }
    window.__TESTS__ = { results };
  } catch (err) {
    window.__TESTS__ = { fatal: String(err && err.stack || err), results };
  }
})();
</script></body></html>"""


def main() -> int:
    cache = find_cache()
    files = project_sources(include_tests=True)
    result, console_errors = run_in_browser(
        {
            "/index.html": ("text/html; charset=utf-8", RUNNER_HTML.encode("utf-8")),
            "/files.json": as_json_payload(files),
            "/typescript.js": ("application/javascript; charset=utf-8", typescript_js(cache)),
        },
        "window.__TESTS__",
        timeout_s=120,
    )
    results = result.get("results", [])
    for r in results:
        mark = "PASS" if r["ok"] else "FAIL"
        print(f"{mark}  {r['file'].lstrip('/')} :: {r['name']}" + ("" if r["ok"] else f"\n      {r['error']}"))
    if result.get("fatal"):
        print("FATAL:", result["fatal"])
        for e in console_errors:
            print(" ", e)
        return 2
    failed = sum(1 for r in results if not r["ok"])
    print(f"\n{len(results) - failed} passed, {failed} failed.")
    return 1 if failed or not results else 0


if __name__ == "__main__":
    sys.exit(main())
