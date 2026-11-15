// Helpers shared by the data build scripts.

import { readFileSync } from "node:fs";

export const DECIMALS = 18;
export const UNIT = 10n ** BigInt(DECIMALS);

/** Minimal RFC 4180 line parser: handles quoted fields and "" escapes (no embedded newlines). */
export function parseLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

/** Decimal string ("397.5153302") or wei string → exact integer amount in 1e-18 units. */
export function toAtto(value, isWei) {
  if (isWei) {
    if (!/^\d+$/.test(value)) throw new Error(`bad wei amount "${value}"`);
    return BigInt(value);
  }
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!m) throw new Error(`bad token amount "${value}"`);
  const frac = (m[2] ?? "").slice(0, DECIMALS).padEnd(DECIMALS, "0");
  return BigInt(m[1]) * UNIT + BigInt(frac);
}

/** 1e-18 units → tokens rounded to 2 decimals (what the UI shows). */
export const toTokens = (atto) => Number((atto + UNIT / 200n) / (UNIT / 100n)) / 100;

/** Reads a CSV export: lowercase header names and the data rows as cell arrays. */
export function readCsv(path) {
  const lines = readFileSync(path, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...names) => {
    const i = header.findIndex((h) => names.includes(h));
    if (i < 0) throw new Error(`missing column ${names.join(" / ")} in ${path}`);
    return i;
  };
  return { header, col, rows: lines.slice(1).map(parseLine), lines };
}
