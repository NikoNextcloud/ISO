import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";

export type ZipEntry = { name: string; data: Buffer; directory?: boolean };

export type WordLogoReplacement = {
  data: Buffer;
  mode: "header-images" | "matching-images";
  sourceHashes?: string[];
};

export type OfficeImageReplacement = {
  data: Buffer;
  sourceHash: string;
};

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Невалиден ZIP файл: липсва централен индекс.");
}

export function readZip(buffer: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Невалиден ZIP централен запис.");
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Невалиден ZIP локален запис.");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : (() => { throw new Error(`Неподдържана ZIP компресия: ${method}`); })();
    entries.push({ name, data, directory: name.endsWith("/") });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export function writeZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  const stamp = dosDateTime(new Date());

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replaceAll("\\", "/"), "utf8");
    const data = entry.directory ? Buffer.alloc(0) : entry.data;
    const method = data.length ? 8 : 0;
    const compressed = method === 8 ? deflateRawSync(data, { level: 6 }) : data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(entry.directory ? 0x10 : 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
    localOffset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function decodeXml(value: string) {
  return value.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16))).replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

function encodeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function replaceOnceAcrossTextNodes(xml: string, source: string, replacement: string) {
  const pattern = /<((?:w:(?:t|delText|instrText)|a:t))\b[^>]*>([\s\S]*?)<\/\1>/g;
  const nodes: { start: number; end: number; text: string }[] = [];
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    const relative = match[0].indexOf(">") + 1;
    nodes.push({ start: match.index + relative, end: match.index + relative + match[2].length, text: decodeXml(match[2]) });
  }
  const joined = nodes.map((node) => node.text).join("");
  const sourceStart = joined.indexOf(source);
  if (sourceStart < 0) return { xml, changed: false };
  const sourceEnd = sourceStart + source.length;
  let running = 0;
  let startIndex = -1;
  let endIndex = -1;
  let startOffset = 0;
  let endOffset = 0;
  nodes.forEach((node, index) => {
    const next = running + node.text.length;
    if (startIndex < 0 && sourceStart >= running && sourceStart < next) { startIndex = index; startOffset = sourceStart - running; }
    if (endIndex < 0 && sourceEnd > running && sourceEnd <= next) { endIndex = index; endOffset = sourceEnd - running; }
    running = next;
  });
  if (startIndex < 0 || endIndex < 0) return { xml, changed: false };
  const contents = nodes.map((node) => node.text);
  if (startIndex === endIndex) contents[startIndex] = contents[startIndex].slice(0, startOffset) + replacement + contents[startIndex].slice(endOffset);
  else {
    contents[startIndex] = contents[startIndex].slice(0, startOffset) + replacement;
    for (let index = startIndex + 1; index < endIndex; index += 1) contents[index] = "";
    contents[endIndex] = contents[endIndex].slice(endOffset);
  }
  let cursor = 0;
  let output = "";
  nodes.forEach((node, index) => { output += xml.slice(cursor, node.start) + encodeXml(contents[index]); cursor = node.end; });
  return { xml: output + xml.slice(cursor), changed: true };
}

function headerImageTargets(entries: ZipEntry[]) {
  const targets = new Set<string>();
  for (const entry of entries) {
    if (!/^word\/_rels\/header\d+\.xml\.rels$/i.test(entry.name)) continue;
    const xml = entry.data.toString("utf8");
    const relationshipPattern = /<Relationship\b[^>]*\bType="[^"]*\/image"[^>]*\bTarget="([^"]+)"[^>]*>|<Relationship\b[^>]*\bTarget="([^"]+)"[^>]*\bType="[^"]*\/image"[^>]*>/gi;
    for (let match = relationshipPattern.exec(xml); match; match = relationshipPattern.exec(xml)) {
      const target = (match[1] || match[2]).replaceAll("\\", "/").replace(/^\.\.\//, "");
      targets.add(target.startsWith("word/") ? target : `word/${target}`);
    }
  }
  return targets;
}

export function replaceWordText(docx: Buffer, replacements: Array<[string, string]>, logo?: WordLogoReplacement, imageReplacements: OfficeImageReplacement[] = []) {
  const sourceEntries = readZip(docx);
  const logoTargets = logo?.mode === "header-images" ? headerImageTargets(sourceEntries) : new Set<string>();
  const sourceHashes = new Set(logo?.sourceHashes ?? []);
  const replacementByHash = new Map(imageReplacements.map((item) => [item.sourceHash, item.data]));
  const customImageTargets = new Map<string, Buffer>();
  if (logo?.mode === "matching-images") {
    sourceEntries.forEach((entry) => {
      if (entry.name.startsWith("word/media/") && sourceHashes.has(createHash("sha256").update(entry.data).digest("hex"))) logoTargets.add(entry.name);
    });
  }
  sourceEntries.forEach((entry) => {
    if (!entry.name.startsWith("word/media/")) return;
    const replacement = replacementByHash.get(createHash("sha256").update(entry.data).digest("hex"));
    if (replacement) customImageTargets.set(entry.name, replacement);
  });
  const pngTargets = new Set([...logoTargets, ...customImageTargets.keys()]);
  const orderedReplacements = [...replacements].sort((a, b) => b[0].length - a[0].length);
  const entries = sourceEntries.map((entry) => {
    if (customImageTargets.has(entry.name)) return { ...entry, data: customImageTargets.get(entry.name)! };
    if (logo && logoTargets.has(entry.name)) return { ...entry, data: logo.data };
    if (entry.name === "[Content_Types].xml" && pngTargets.size) {
      return { ...entry, data: Buffer.from(addPngContentTypeOverrides(entry.data.toString("utf8"), pngTargets), "utf8") };
    }
    const isWordXml = entry.name.startsWith("word/") && entry.name.endsWith(".xml");
    const isDocumentPropertyXml = entry.name.startsWith("docProps/") && entry.name.endsWith(".xml");
    if (!isWordXml && !isDocumentPropertyXml) return entry;
    let xml = entry.data.toString("utf8");
    for (const [source, replacement] of orderedReplacements) {
      if (!source || source === replacement) continue;
      if (isDocumentPropertyXml) {
        xml = replaceDocumentTitleProperty(xml, source, replacement);
        continue;
      }
      for (;;) {
        const result = replaceOnceAcrossTextNodes(xml, source, replacement);
        xml = result.xml;
        if (!result.changed) break;
      }
    }
    return { ...entry, data: Buffer.from(xml, "utf8") };
  });
  return writeZip(entries);
}

export function replaceSpreadsheetText(xlsx: Buffer, replacements: Array<[string, string]>, logo?: WordLogoReplacement, imageReplacements: OfficeImageReplacement[] = []) {
  const sourceEntries = readZip(xlsx);
  const logoTargets = new Set<string>();
  const sourceHashes = new Set(logo?.sourceHashes ?? []);
  const replacementByHash = new Map(imageReplacements.map((item) => [item.sourceHash, item.data]));
  const customImageTargets = new Map<string, Buffer>();
  if (logo?.mode === "matching-images") {
    sourceEntries.forEach((entry) => {
      if (entry.name.startsWith("xl/media/") && sourceHashes.has(createHash("sha256").update(entry.data).digest("hex"))) logoTargets.add(entry.name);
    });
  }
  sourceEntries.forEach((entry) => {
    if (!entry.name.startsWith("xl/media/")) return;
    const replacement = replacementByHash.get(createHash("sha256").update(entry.data).digest("hex"));
    if (replacement) customImageTargets.set(entry.name, replacement);
  });
  const pngTargets = new Set([...logoTargets, ...customImageTargets.keys()]);
  const orderedReplacements = [...replacements].sort((a, b) => b[0].length - a[0].length);
  const entries = sourceEntries.map((entry) => {
    if (customImageTargets.has(entry.name)) return { ...entry, data: customImageTargets.get(entry.name)! };
    if (logo && logoTargets.has(entry.name)) return { ...entry, data: logo.data };
    if (entry.name === "[Content_Types].xml" && pngTargets.size) {
      return { ...entry, data: Buffer.from(addPngContentTypeOverrides(entry.data.toString("utf8"), pngTargets), "utf8") };
    }
    const isSpreadsheetXml = entry.name.startsWith("xl/") && entry.name.endsWith(".xml");
    const isDocumentPropertyXml = entry.name.startsWith("docProps/") && entry.name.endsWith(".xml");
    if (!isSpreadsheetXml && !isDocumentPropertyXml) return entry;

    let xml = entry.data.toString("utf8");
    for (const [source, replacement] of orderedReplacements) {
      if (!source || source === replacement) continue;
      if (isDocumentPropertyXml) {
        xml = replaceDocumentTitleProperty(xml, source, replacement);
        continue;
      }
      for (;;) {
        const result = replaceOnceAcrossSpreadsheetTextNodes(xml, source, replacement);
        xml = result.xml;
        if (!result.changed) break;
      }
      xml = replaceSpreadsheetAttributeValues(xml, source, replacement);
    }
    return { ...entry, data: Buffer.from(xml, "utf8") };
  });
  return writeZip(entries);
}

function replaceOnceAcrossSpreadsheetTextNodes(xml: string, source: string, replacement: string) {
  const pattern = /<((?:(?:[a-z][\w.-]*):)?t)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  const nodes: { start: number; end: number; text: string }[] = [];
  for (let match = pattern.exec(xml); match; match = pattern.exec(xml)) {
    const relative = match[0].indexOf(">") + 1;
    nodes.push({ start: match.index + relative, end: match.index + relative + match[2].length, text: decodeXml(match[2]) });
  }
  const joined = nodes.map((node) => node.text).join("");
  const sourceStart = joined.indexOf(source);
  if (sourceStart < 0) return { xml, changed: false };
  const sourceEnd = sourceStart + source.length;
  let running = 0;
  let startIndex = -1;
  let endIndex = -1;
  let startOffset = 0;
  let endOffset = 0;
  nodes.forEach((node, index) => {
    const next = running + node.text.length;
    if (startIndex < 0 && sourceStart >= running && sourceStart < next) { startIndex = index; startOffset = sourceStart - running; }
    if (endIndex < 0 && sourceEnd > running && sourceEnd <= next) { endIndex = index; endOffset = sourceEnd - running; }
    running = next;
  });
  if (startIndex < 0 || endIndex < 0) return { xml, changed: false };
  const contents = nodes.map((node) => node.text);
  if (startIndex === endIndex) contents[startIndex] = contents[startIndex].slice(0, startOffset) + replacement + contents[startIndex].slice(endOffset);
  else {
    contents[startIndex] = contents[startIndex].slice(0, startOffset) + replacement;
    for (let index = startIndex + 1; index < endIndex; index += 1) contents[index] = "";
    contents[endIndex] = contents[endIndex].slice(endOffset);
  }
  let cursor = 0;
  let output = "";
  nodes.forEach((node, index) => { output += xml.slice(cursor, node.start) + encodeXml(contents[index]); cursor = node.end; });
  return { xml: output + xml.slice(cursor), changed: true };
}

function replaceSpreadsheetAttributeValues(xml: string, source: string, replacement: string) {
  return xml.replace(/(\s[\w:.-]+=")([^"]*)(")/g, (match, prefix: string, value: string, suffix: string) => {
    const decoded = decodeXml(value);
    if (!decoded.includes(source)) return match;
    return `${prefix}${encodeXml(decoded.replaceAll(source, replacement))}${suffix}`;
  });
}

function replaceDocumentTitleProperty(xml: string, source: string, replacement: string) {
  const pattern = /<((?:dc:(?:title|subject)|cp:(?:keywords|category|contentStatus)))(\b[^>]*)>([\s\S]*?)<\/\1>/gi;
  return xml.replace(pattern, (match, tag: string, attributes: string, value: string) => {
    const decoded = decodeXml(value);
    if (!decoded.includes(source)) return match;
    return `<${tag}${attributes}>${encodeXml(decoded.replaceAll(source, replacement))}</${tag}>`;
  });
}

function addPngContentTypeOverrides(xml: string, targets: Set<string>) {
  let result = xml;
  for (const target of targets) {
    const partName = `/${target}`;
    const override = `<Override PartName="${encodeXml(partName)}" ContentType="image/png"/>`;
    const existing = new RegExp(`<Override\\b(?=[^>]*\\bPartName="${escapeRegExp(partName)}")[^>]*/>`, "gi");
    if (existing.test(result)) result = result.replace(existing, override);
    else result = result.replace(/<\/Types>\s*$/i, `${override}</Types>`);
  }
  return result;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
