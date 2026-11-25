"""
Full TypeScript type check (`tsc --noEmit` equivalent) without Node.js.

Runs the real TypeScript compiler inside headless Chrome/Edge against src/**.
Uses the cached compiler and type definitions described in tslib.py.

Usage:
  uv run --no-project --python 3.12 python tests/typecheck.py
Exit code 0 = no type errors.
"""

import json
import sys

from tslib import ROOT, as_json_payload, find_cache, project_sources, run_in_browser, typescript_js

COMPILER_OPTIONS = json.loads((ROOT / "tsconfig.json").read_text(encoding="utf-8"))["compilerOptions"]

CHECKER_HTML = """<!doctype html><html><head><meta charset="utf-8"><title>AG typecheck</title>
<script src="/typescript.js"></script></head><body><script>
(async () => {
  try {
    const files = await (await fetch('/vfs.json')).json();
    const opts = await (await fetch('/options.json')).json();
    const dirs = new Set(['/']);
    for (const f of Object.keys(files)) { let d = f; while ((d = d.slice(0, d.lastIndexOf('/')))) dirs.add(d); }
    const parsed = ts.convertCompilerOptionsFromJson(opts, '/');
    if (parsed.errors.length) throw new Error(parsed.errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, '\\n')).join('; '));
    const libDir = '/node_modules/typescript/lib/';
    const cache = new Map();
    const host = {
      getSourceFile(name, lang) {
        if (cache.has(name)) return cache.get(name);
        const text = files[name];
        const sf = text === undefined ? undefined : ts.createSourceFile(name, text, lang, true);
        cache.set(name, sf);
        return sf;
      },
      getDefaultLibFileName: (o) => libDir + ts.getDefaultLibFileName(o),
      getDefaultLibLocation: () => libDir.slice(0, -1),
      writeFile() {},
      getCurrentDirectory: () => '/',
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\\n',
      fileExists: (f) => Object.prototype.hasOwnProperty.call(files, f),
      readFile: (f) => files[f],
      directoryExists: (d) => dirs.has(d.replace(/\\/$/, '') || '/'),
      getDirectories: (d) => {
        const base = d.replace(/\\/$/, '');
        const out = new Set();
        for (const x of dirs) if (x.startsWith(base + '/') && !x.slice(base.length + 1).includes('/')) out.add(x.slice(base.length + 1));
        return [...out];
      },
      realpath: (p) => p,
    };
    const roots = Object.keys(files).filter((f) => f.startsWith('/src/') && /\\.(ts|tsx)$/.test(f));
    const program = ts.createProgram({ rootNames: roots, options: parsed.options, host });
    const diags = ts.getPreEmitDiagnostics(program);
    window.__TYPECHECK__ = {
      version: ts.version,
      rootCount: roots.length,
      diagnostics: diags.map((d) => {
        const pos = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : null;
        return { file: d.file ? d.file.fileName : '', line: pos ? pos.line + 1 : 0, col: pos ? pos.character + 1 : 0,
                 code: d.code, category: ts.DiagnosticCategory[d.category], message: ts.flattenDiagnosticMessageText(d.messageText, '\\n') };
      }),
    };
  } catch (err) {
    window.__TYPECHECK__ = { fatal: String(err && err.stack || err) };
  }
})();
</script></body></html>"""


def build_vfs(cache) -> dict:
    files = project_sources()
    modules = cache / "node_modules"
    for path in modules.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(cache).as_posix()
        if rel.startswith("node_modules/@cloudflare/workers-types/") and rel.count("/") > 3:
            continue  # per-compatibility-date copies; the root index.d.ts is what resolves
        if path.name == "package.json" or path.name.endswith((".d.ts", ".d.mts", ".d.cts")):
            files["/" + rel] = path.read_text(encoding="utf-8", errors="replace")
    return files


def main() -> int:
    cache = find_cache()
    print(f"Using TypeScript cache: {cache}")
    files = build_vfs(cache)
    print(f"Type checking {sum(1 for f in files if f.startswith('/src/'))} source files in headless browser...")
    result, _ = run_in_browser(
        {
            "/index.html": ("text/html; charset=utf-8", CHECKER_HTML.encode("utf-8")),
            "/vfs.json": as_json_payload(files),
            "/options.json": as_json_payload(COMPILER_OPTIONS),
            "/typescript.js": ("application/javascript; charset=utf-8", typescript_js(cache)),
        },
        "window.__TYPECHECK__",
    )
    if result.get("fatal"):
        print("FATAL:", result["fatal"])
        return 2
    errors = [d for d in result["diagnostics"] if d["category"] == "Error"]
    for d in sorted(errors, key=lambda x: (x["file"], x["line"], x["col"])):
        loc = f"{d['file'].lstrip('/')}:{d['line']}:{d['col']}" if d["file"] else "(global)"
        print(f"{loc}  TS{d['code']}: {d['message']}")
    print(f"\nTypeScript {result['version']}: {len(errors)} error(s) in {result['rootCount']} files.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
