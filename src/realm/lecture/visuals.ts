/**
 * Draws a lecture's animated diagram (see LectureVisual in
 * curriculum/banks/lectures/types.ts) onto a 2D canvas: the theatre's big
 * screen. `progress` runs 0 -> 1 while the professor talks; parts appear one
 * at a time (fade and slide in), arrows draw themselves, bars grow.
 */

import type { LectureVisual } from "../curriculum/banks/lectures/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GOLD = "#e8c25a";
const GOLD_SOFT = "rgba(232,194,90,0.55)";
const INK = "#f3ecd8";
const MUTED = "#b9b4a4";
const BOX = "rgba(40,52,96,0.92)";
const BOX_HI = "rgba(70,62,30,0.95)";
const FONT = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** How far item `i` of `n` has appeared at overall `progress` (items overlap a little). */
function appear(i: number, n: number, progress: number): number {
  const span = 1 / Math.max(1, n);
  return ease((progress - i * span * 0.9) / (span * 1.1));
}

function wrapLines(g: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && g.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

/** Writes text centred in a box, shrinking the font until it fits. */
function fitText(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, width: number, height: number, size: number, opts: { font?: string; color?: string; weight?: string; maxLines?: number } = {}): void {
  const maxLines = opts.maxLines ?? 3;
  let s = size;
  let lines: string[] = [];
  for (; s >= 14; s -= 2) {
    g.font = `${opts.weight ?? ""} ${s}px ${opts.font ?? SANS}`;
    lines = wrapLines(g, text, width, maxLines);
    if (lines.length * s * 1.2 <= height && lines.every((l) => g.measureText(l).width <= width)) break;
  }
  g.fillStyle = opts.color ?? INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const lh = s * 1.2;
  lines.forEach((l, i) => g.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * lh));
}

function roundBox(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke = GOLD_SOFT): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 2.5;
  g.strokeStyle = stroke;
  g.stroke();
}

/** An arrow from a to b, drawn up to fraction `t`. */
function arrow(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, t: number, color = GOLD): void {
  if (t <= 0) return;
  const ex = ax + (bx - ax) * t;
  const ey = ay + (by - ay) * t;
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(ex, ey);
  g.stroke();
  if (t > 0.85) {
    const ang = Math.atan2(by - ay, bx - ax);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo(ex - 16 * Math.cos(ang - 0.45), ey - 16 * Math.sin(ang - 0.45));
    g.lineTo(ex - 16 * Math.cos(ang + 0.45), ey - 16 * Math.sin(ang + 0.45));
    g.closePath();
    g.fill();
  }
}

/** Fades and lifts whatever `draw` paints, by appearance `a` (0..1). */
function withAppear(g: CanvasRenderingContext2D, a: number, draw: () => void): void {
  if (a <= 0) return;
  g.save();
  g.globalAlpha *= a;
  g.translate(0, (1 - a) * 18);
  draw();
  g.restore();
}

function caption(g: CanvasRenderingContext2D, title: string | undefined, r: Rect): Rect {
  if (!title) return r;
  g.font = `italic 26px ${FONT}`;
  g.fillStyle = MUTED;
  g.textAlign = "center";
  g.textBaseline = "top";
  g.fillText(title, r.x + r.w / 2, r.y);
  return { x: r.x, y: r.y + 44, w: r.w, h: r.h - 44 };
}

export function drawVisual(g: CanvasRenderingContext2D, visual: LectureVisual, area: Rect, progress: number): void {
  g.save();
  switch (visual.kind) {
    case "flow": {
      const r = caption(g, visual.title, area);
      const n = visual.steps.length;
      const gap = 44;
      const bw = Math.min(260, (r.w - gap * (n - 1)) / n);
      const total = bw * n + gap * (n - 1);
      const x0 = r.x + (r.w - total) / 2;
      const bh = Math.min(170, r.h * 0.6);
      const y = r.y + (r.h - bh) / 2;
      visual.steps.forEach((step, i) => {
        const a = appear(i, n, progress);
        const x = x0 + i * (bw + gap);
        withAppear(g, a, () => {
          roundBox(g, x, y, bw, bh, 18, i === n - 1 ? BOX_HI : BOX);
          g.font = `bold 20px ${SANS}`;
          g.fillStyle = GOLD;
          g.textAlign = "center";
          g.textBaseline = "top";
          g.fillText(String(i + 1), x + bw / 2, y + 12);
          fitText(g, step, x + bw / 2, y + bh / 2 + 12, bw - 24, bh - 50, 30);
        });
        if (i > 0) arrow(g, x - gap + 6, y + bh / 2, x - 6, y + bh / 2, ease((a - 0.1) / 0.6));
      });
      break;
    }
    case "cycle": {
      const r = caption(g, visual.title, area);
      const n = visual.steps.length;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const rx = Math.min(r.w * 0.36, 420);
      const ry = Math.min(r.h * 0.36, 170);
      const bw = Math.min(230, (rx * 2) / Math.max(2, n - 1) + 60);
      const bh = 84;
      const pos = visual.steps.map((_, i) => {
        const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
        return { x: cx + Math.cos(ang) * rx, y: cy + Math.sin(ang) * ry };
      });
      // Arcs first, so boxes sit on top.
      visual.steps.forEach((_, i) => {
        // The arc to the next step draws as that step appears; the closing arc comes last.
        const t = i === n - 1 ? ease((progress - 0.88) / 0.12) : appear(i + 1, n, progress);
        if (t <= 0) return;
        const from = pos[i];
        const to = pos[(i + 1) % n];
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const len = Math.hypot(dx, dy) || 1;
        const ctrl = { x: mx + (dx / len) * 50, y: my + (dy / len) * 50 };
        g.strokeStyle = GOLD_SOFT;
        g.lineWidth = 4;
        g.beginPath();
        const steps = 24;
        for (let k = 0; k <= steps * t; k++) {
          const u = k / steps;
          const x = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * ctrl.x + u * u * to.x;
          const y = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * ctrl.y + u * u * to.y;
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      });
      visual.steps.forEach((step, i) => {
        withAppear(g, appear(i, n, progress), () => {
          roundBox(g, pos[i].x - bw / 2, pos[i].y - bh / 2, bw, bh, 40, BOX);
          fitText(g, step, pos[i].x, pos[i].y, bw - 28, bh - 14, 26, { maxLines: 2 });
        });
      });
      withAppear(g, ease(progress * 3), () => {
        g.font = `bold 46px ${FONT}`;
        g.fillStyle = "rgba(232,194,90,0.35)";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("↻", cx, cy);
      });
      break;
    }
    case "compare": {
      const cols = [visual.left, visual.right];
      const colW = area.w * 0.42;
      const xs = [area.x + area.w * 0.04, area.x + area.w * 0.54];
      const rows = Math.max(visual.left.items.length, visual.right.items.length);
      const n = 2 + rows * 2;
      cols.forEach((col, c) => {
        withAppear(g, appear(c, n, progress), () => {
          roundBox(g, xs[c], area.y, colW, 70, 16, c === 0 ? BOX : BOX_HI);
          fitText(g, col.title, xs[c] + colW / 2, area.y + 35, colW - 30, 60, 34, { weight: "bold", color: GOLD, maxLines: 1 });
        });
        const itemH = Math.min(78, (area.h - 96) / Math.max(1, rows) - 10);
        col.items.forEach((item, i) => {
          withAppear(g, appear(2 + i * 2 + c, n, progress), () => {
            const y = area.y + 90 + i * (itemH + 10);
            roundBox(g, xs[c], y, colW, itemH, 12, "rgba(255,255,255,0.05)", "rgba(232,194,90,0.25)");
            fitText(g, item, xs[c] + colW / 2, y + itemH / 2, colW - 30, itemH - 10, 26, { maxLines: 2 });
          });
        });
      });
      withAppear(g, appear(1, n, progress), () => {
        g.font = `italic bold 40px ${FONT}`;
        g.fillStyle = GOLD;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("vs", area.x + area.w / 2, area.y + 35);
      });
      break;
    }
    case "stack": {
      const r = caption(g, visual.title, area);
      const n = visual.layers.length;
      const gap = 10;
      const lh = Math.min(84, (r.h - gap * (n - 1)) / n);
      const top = r.y + (r.h - (lh * n + gap * (n - 1))) / 2;
      visual.layers.forEach((layer, i) => {
        withAppear(g, appear(i, n, progress), () => {
          const inset = i * 16;
          const y = top + i * (lh + gap);
          roundBox(g, r.x + r.w * 0.12 + inset, y, r.w * 0.76 - inset * 2, lh, 12, i % 2 ? BOX : "rgba(52,64,112,0.92)");
          fitText(g, layer, r.x + r.w / 2, y + lh / 2, r.w * 0.7 - inset * 2, lh - 10, 30, { maxLines: 1 });
        });
      });
      break;
    }
    case "timeline": {
      const r = caption(g, visual.title, area);
      const n = visual.events.length;
      const y = r.y + r.h * 0.45;
      const x0 = r.x + 40;
      const x1 = r.x + r.w - 40;
      g.strokeStyle = GOLD_SOFT;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + (x1 - x0) * ease(progress * 1.2), y);
      g.stroke();
      const slot = (x1 - x0) / n;
      visual.events.forEach((ev, i) => {
        const x = x0 + slot * (i + 0.5);
        withAppear(g, appear(i, n, progress), () => {
          g.fillStyle = GOLD;
          g.beginPath();
          g.arc(x, y, 13, 0, Math.PI * 2);
          g.fill();
          fitText(g, ev.label, x, y - 62, slot - 16, 80, 28, { weight: "bold", color: INK, maxLines: 2 });
          fitText(g, ev.detail, x, y + 80, slot - 16, 110, 22, { color: MUTED, maxLines: 4 });
        });
      });
      break;
    }
    case "formula": {
      g.textAlign = "center";
      g.textBaseline = "middle";
      withAppear(g, ease(progress * 4), () => {
        roundBox(g, area.x + area.w * 0.1, area.y, area.w * 0.8, 92, 18, BOX_HI);
        fitText(g, visual.formula, area.x + area.w / 2, area.y + 46, area.w * 0.75, 80, 44, { font: FONT, weight: "bold", color: GOLD, maxLines: 1 });
      });
      const n = visual.steps.length;
      const lh = Math.min(70, (area.h - 120) / Math.max(1, n));
      visual.steps.forEach((step, i) => {
        withAppear(g, appear(i + 0.6, n + 0.6, progress), () => {
          const y = area.y + 130 + i * lh + lh / 2;
          const last = i === n - 1;
          fitText(g, step, area.x + area.w / 2, y, area.w * 0.86, lh - 6, last ? 34 : 30, { weight: last ? "bold" : "", color: last ? GOLD : INK, maxLines: 1 });
        });
      });
      break;
    }
    case "matrix": {
      const r = caption(g, visual.title, area);
      const rows = visual.rows.length;
      const cols = visual.cols.length;
      const lw = 170;
      const top = 54;
      const gx = r.x + lw + 30;
      const gw = r.w - lw - 60;
      const gh = r.h - top - 40;
      const cw = gw / cols;
      const ch = gh / rows;
      withAppear(g, ease(progress * 4), () => {
        fitText(g, visual.colLabel, gx + gw / 2, r.y + 12, gw, 30, 22, { color: MUTED, maxLines: 1 });
        visual.cols.forEach((c, j) => fitText(g, c, gx + cw * j + cw / 2, r.y + 40, cw - 10, 30, 24, { weight: "bold", color: GOLD, maxLines: 1 }));
        visual.rows.forEach((row, i) => fitText(g, row, r.x + lw / 2 + 10, r.y + top + ch * i + ch / 2, lw, ch - 8, 24, { weight: "bold", color: GOLD, maxLines: 2 }));
        g.save();
        g.translate(r.x + 4, r.y + top + gh / 2);
        g.rotate(-Math.PI / 2);
        fitText(g, visual.rowLabel, 0, 0, gh, 26, 22, { color: MUTED, maxLines: 1 });
        g.restore();
      });
      const n = rows * cols;
      visual.rows.forEach((_, i) =>
        visual.cols.forEach((__, j) => {
          const k = i * cols + j;
          withAppear(g, appear(k, n, progress * 0.9 + 0.1), () => {
            const heat = (j / Math.max(1, cols - 1) + (1 - i / Math.max(1, rows - 1))) / 2;
            const fill = `rgba(${Math.round(60 + heat * 120)},${Math.round(60 + (1 - heat) * 40)},${Math.round(110 - heat * 70)},0.9)`;
            roundBox(g, gx + cw * j + 5, r.y + top + ch * i + 5, cw - 10, ch - 10, 12, fill);
            fitText(g, visual.cells[i]?.[j] ?? "", gx + cw * j + cw / 2, r.y + top + ch * i + ch / 2, cw - 30, ch - 20, 26, { maxLines: 3 });
          });
        }),
      );
      break;
    }
    case "tree": {
      const n = visual.children.length;
      const rootW = Math.min(420, area.w * 0.4);
      const rootX = area.x + area.w / 2 - rootW / 2;
      withAppear(g, ease(progress * 4), () => {
        roundBox(g, rootX, area.y, rootW, 74, 16, BOX_HI);
        fitText(g, visual.root, area.x + area.w / 2, area.y + 37, rootW - 30, 64, 32, { weight: "bold", color: GOLD, maxLines: 2 });
      });
      const cw = area.w / n;
      visual.children.forEach((child, i) => {
        const a = appear(i + 0.5, n + 0.5, progress);
        const cx = area.x + cw * i + cw / 2;
        const cy = area.y + 150;
        arrow(g, area.x + area.w / 2, area.y + 76, cx, cy - 4, ease(a * 1.5), GOLD_SOFT);
        withAppear(g, a, () => {
          roundBox(g, cx - cw / 2 + 10, cy, cw - 20, 66, 14, BOX);
          fitText(g, child.label, cx, cy + 33, cw - 40, 58, 26, { weight: "bold", maxLines: 2 });
          (child.children ?? []).slice(0, 4).forEach((sub, k) => {
            const y = cy + 92 + k * 52;
            g.strokeStyle = "rgba(232,194,90,0.3)";
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(cx - cw / 2 + 26, cy + 66);
            g.lineTo(cx - cw / 2 + 26, y + 20);
            g.lineTo(cx - cw / 2 + 38, y + 20);
            g.stroke();
            roundBox(g, cx - cw / 2 + 40, y, cw - 60, 42, 10, "rgba(255,255,255,0.05)", "rgba(232,194,90,0.25)");
            fitText(g, sub, cx + 10, y + 21, cw - 80, 38, 20, { maxLines: 1 });
          });
        });
      });
      break;
    }
    case "bars": {
      const r = caption(g, visual.title, area);
      const n = visual.items.length;
      const max = Math.max(1e-9, ...visual.items.map((it) => it.value));
      const lw = 260;
      const bh = Math.min(64, (r.h - 10 * (n - 1)) / n);
      const top = r.y + (r.h - (bh * n + 10 * (n - 1))) / 2;
      visual.items.forEach((it, i) => {
        const a = appear(i, n, progress);
        const y = top + i * (bh + 10);
        withAppear(g, Math.min(1, a * 2), () => {
          fitText(g, it.label, r.x + lw / 2, y + bh / 2, lw - 20, bh, 26, { maxLines: 2 });
          const full = (r.w - lw - 170) * (it.value / max);
          const grad = g.createLinearGradient(r.x + lw, 0, r.x + lw + full, 0);
          grad.addColorStop(0, "#5a6fc0");
          grad.addColorStop(1, GOLD);
          g.fillStyle = grad;
          g.fillRect(r.x + lw, y + 6, full * ease(a), bh - 12);
          g.font = `bold 26px ${SANS}`;
          g.fillStyle = INK;
          g.textAlign = "left";
          g.textBaseline = "middle";
          const value = `${Number.isInteger(it.value) ? it.value.toLocaleString() : it.value.toFixed(2)}${visual.unit ? ` ${visual.unit}` : ""}`;
          g.fillText(value, r.x + lw + full * ease(a) + 14, y + bh / 2);
        });
      });
      break;
    }
    case "definition": {
      withAppear(g, ease(progress * 3), () => {
        fitText(g, visual.term, area.x + area.w / 2, area.y + area.h * 0.22, area.w * 0.85, 110, 76, { font: FONT, weight: "bold", color: GOLD, maxLines: 1 });
        g.fillStyle = GOLD_SOFT;
        g.fillRect(area.x + area.w / 2 - 160 * ease(progress * 2), area.y + area.h * 0.22 + 62, 320 * ease(progress * 2), 3);
      });
      withAppear(g, ease((progress - 0.15) * 2.5), () => {
        fitText(g, visual.definition, area.x + area.w / 2, area.y + area.h * 0.62, area.w * 0.8, area.h * 0.5, 40, { font: FONT, maxLines: 4 });
      });
      break;
    }
  }
  g.restore();
}

// ---------------------------------------------------------------------------
// Checking untrusted visuals (from a cache or the server)
// ---------------------------------------------------------------------------

const s = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
const list = (v: unknown, n: number, max = 120) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").slice(0, n).map((x) => x.slice(0, max)) : []);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Returns a well-formed visual, or undefined when it can't be drawn. */
export function sanitizeVisual(raw: unknown): LectureVisual | undefined {
  if (!isObj(raw)) return undefined;
  const title = s(raw.title) || undefined;
  switch (raw.kind) {
    case "flow":
    case "cycle": {
      const steps = list(raw.steps, 6);
      return steps.length >= (raw.kind === "flow" ? 2 : 3) ? { kind: raw.kind, title, steps } : undefined;
    }
    case "compare": {
      const side = (v: unknown) => (isObj(v) ? { title: s(v.title, 60), items: list(v.items, 4) } : null);
      const left = side(raw.left);
      const right = side(raw.right);
      return left && right && left.title && right.title && left.items.length && right.items.length ? { kind: "compare", left, right } : undefined;
    }
    case "stack": {
      const layers = list(raw.layers, 6);
      return layers.length >= 2 ? { kind: "stack", title, layers } : undefined;
    }
    case "timeline": {
      const events = (Array.isArray(raw.events) ? raw.events : []).filter(isObj).slice(0, 6).map((e) => ({ label: s(e.label, 60), detail: s(e.detail, 140) })).filter((e) => e.label);
      return events.length >= 2 ? { kind: "timeline", title, events } : undefined;
    }
    case "formula": {
      const formula = s(raw.formula, 80);
      const steps = list(raw.steps, 5, 160);
      return formula && steps.length ? { kind: "formula", formula, steps } : undefined;
    }
    case "matrix": {
      const rows = list(raw.rows, 3, 40);
      const cols = list(raw.cols, 3, 40);
      // Cells may be blank (e.g. a 3x3 grid with five styles in their right places).
      const cells = (Array.isArray(raw.cells) ? raw.cells : []).slice(0, rows.length).map((r) => (Array.isArray(r) ? r.slice(0, cols.length).map((c) => s(c, 80)) : []));
      return rows.length >= 2 && cols.length >= 2 && cells.length === rows.length && cells.every((r) => r.length === cols.length)
        ? { kind: "matrix", title, rowLabel: s(raw.rowLabel, 40), colLabel: s(raw.colLabel, 40), rows, cols, cells }
        : undefined;
    }
    case "tree": {
      const root = s(raw.root, 60);
      const children = (Array.isArray(raw.children) ? raw.children : []).filter(isObj).slice(0, 5).map((c) => {
          const sub = list(c.children, 4, 50);
          return sub.length ? { label: s(c.label, 50), children: sub } : { label: s(c.label, 50) };
        })
        .filter((c) => c.label);
      return root && children.length >= 2 ? { kind: "tree", root, children } : undefined;
    }
    case "bars": {
      const items = (Array.isArray(raw.items) ? raw.items : [])
        .filter(isObj)
        .slice(0, 6)
        .map((it) => ({ label: s(it.label, 50), value: typeof it.value === "number" && Number.isFinite(it.value) ? Math.max(0, it.value) : -1 }))
        .filter((it) => it.label && it.value >= 0);
      return items.length >= 2 ? { kind: "bars", title, unit: s(raw.unit, 16) || undefined, items } : undefined;
    }
    case "definition": {
      const term = s(raw.term, 60);
      const definition = s(raw.definition, 300);
      return term && definition ? { kind: "definition", term, definition } : undefined;
    }
    default:
      return undefined;
  }
}
