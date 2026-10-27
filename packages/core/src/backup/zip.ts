import type { Backup } from './backup';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (o do zip e do PNG). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Data e hora no formato do MS-DOS, que o zip usa. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Monta um .zip sem compressão (método "stored"), que qualquer celular ou computador
 * abre. Sem dependência nativa: é só juntar bytes. Nomes em UTF-8.
 */
export function createZip(entries: readonly ZipEntry[], modifiedAt = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(modifiedAt);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // versão necessária
    l.setUint16(6, 0x0800, true); // nome em UTF-8
    l.setUint16(8, 0, true); // stored
    l.setUint16(10, stamp.time, true);
    l.setUint16(12, stamp.date, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, size, true);
    l.setUint32(22, size, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, stamp.time, true);
    c.setUint16(14, stamp.date, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, size, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, entry.data);
    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const zip = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    zip.set(part, at);
    at += part.length;
  }
  return zip;
}

/**
 * O backup num único .zip com os CSVs, para compartilhar de uma vez. Cada CSV ganha o
 * BOM do UTF-8 para que o Excel leia os acentos.
 */
export function backupToZip(backup: Backup): Uint8Array {
  const encoder = new TextEncoder();
  const bom = String.fromCharCode(0xfeff);
  return createZip(
    backup.files.map((file) => ({ name: file.name, data: encoder.encode(bom + file.csv) })),
    new Date(backup.createdAt),
  );
}
