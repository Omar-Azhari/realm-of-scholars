/**
 * Reads the text out of a PowerPoint (.pptx) file in the browser, with no
 * library: a .pptx is a zip of XML files, one per slide. Uses the
 * browser's built-in DecompressionStream for the zip's deflate data.
 * Text only — nothing from the file is ever rendered as HTML.
 */

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
}

function readEntries(view: DataView, bytes: Uint8Array): ZipEntry[] {
  // End of central directory: scan back from the end for its signature.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That file isn't a valid .pptx.");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < count && offset + 46 <= bytes.length; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function entryText(view: DataView, bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const local = entry.localOffset;
  if (view.getUint32(local, true) !== 0x04034b50) return "";
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  const raw = bytes.subarray(start, start + entry.compressedSize);
  const data = entry.method === 0 ? raw : entry.method === 8 ? await inflate(raw) : new Uint8Array();
  return new TextDecoder().decode(data);
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Slide text in order, one block per slide, paragraphs on their own lines. Speaker notes are included. */
export async function extractPptxText(buffer: ArrayBuffer): Promise<string> {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser can't read .pptx files. Save the slides as PDF and upload that.");
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const entries = readEntries(view, bytes);
  const number = (name: string) => Number(/(\d+)\.xml$/.exec(name)?.[1] ?? 0);
  const slides = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name)).sort((a, b) => number(a.name) - number(b.name));
  const notes = new Map(entries.filter((e) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(e.name)).map((e) => [number(e.name), e]));
  if (slides.length === 0) throw new Error("No slides were found in that file.");
  const out: string[] = [];
  for (const slide of slides) {
    const xmlText = async (entry: ZipEntry) =>
      (await entryText(view, bytes, entry))
        .split(/<\/a:p>/)
        .map((paragraph) => decodeXml([...paragraph.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join("")).trim())
        .filter(Boolean)
        .join("\n");
    const body = await xmlText(slide);
    const note = notes.get(number(slide.name));
    const noteText = note ? await xmlText(note) : "";
    out.push(`[Slide ${number(slide.name)}]\n${body}${noteText ? `\nNotes: ${noteText}` : ""}`);
  }
  return out.join("\n\n");
}
