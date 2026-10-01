// Loads the real app.js in Node with a minimal fake browser, so the checks in
// this folder test exactly the code and data that ship.
import { readFileSync } from "node:fs";
import vm from "node:vm";

export function loadApp() {
  const fakeElement = () => new Proxy({}, {
    get: (target, key) => key in target ? target[key]
      : ["addEventListener", "setAttribute", "querySelectorAll", "observe"].includes(key) ? () => [] : fakeElement(),
    set: (target, key, value) => { target[key] = value; return true; }
  });
  const sandbox = {
    console, Intl, Date, Math, JSON, Number, String, Set, Map, URLSearchParams,
    document: { querySelector: () => fakeElement() },
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: {},
    window: { location: { protocol: "file:" }, setInterval: () => 0, addEventListener: () => {} },
    ResizeObserver: class { observe() {} },
    fetch: () => new Promise(() => {})
  };
  vm.createContext(sandbox);
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  vm.runInContext(`${source}\n;globalThis.__app = { ROADS, EVEN_SIDE, curbSegments, offsetPath, statusFor, nextWindow, state };`, sandbox);
  return sandbox.__app;
}

export function readCsv(url) {
  const [header, ...lines] = readFileSync(url, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const parse = (line) => {
    const out = []; let cur = ""; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; } else if (ch === '"') quoted = false; else cur += ch; }
      else if (ch === '"') quoted = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur); return out;
  };
  const keys = parse(header);
  return lines.map((line) => Object.fromEntries(parse(line).map((value, i) => [keys[i], value])));
}
