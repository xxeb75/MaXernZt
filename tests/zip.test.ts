import { describe, it, expect } from 'vitest';
import { makeZip } from '../src/zip';

const enc = new TextEncoder(), dec = new TextDecoder();

/** Mini-lecteur de zip (sans compression) : lit le répertoire central, comme le ferait un décompresseur. */
async function readZip(blob: Blob) {
  const b = new Uint8Array(await blob.arrayBuffer()), v = new DataView(b.buffer);
  const eocd = b.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true), cdSize = v.getUint32(eocd + 12, true), cdOff = v.getUint32(eocd + 16, true);
  expect(cdOff + cdSize).toBe(eocd);
  const out: { name: string; data: Uint8Array; crc: number; flags: number }[] = [];
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), csize = v.getUint32(p + 20, true), size = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true), off = v.getUint32(p + 42, true), name = dec.decode(b.subarray(p + 46, p + 46 + nlen));
    expect(method).toBe(0); expect(csize).toBe(size);
    expect(v.getUint32(off, true)).toBe(0x04034b50);
    const lnlen = v.getUint16(off + 26, true), dataStart = off + 30 + lnlen;
    expect(dec.decode(b.subarray(off + 30, dataStart))).toBe(name);
    out.push({ name, data: b.slice(dataStart, dataStart + size), crc, flags });
    p += 46 + nlen;
  }
  return out;
}

describe('makeZip', () => {
  it('type MIME application/zip', () => {
    expect(makeZip([]).type).toBe('application/zip');
  });

  it('archive vide : seulement la fin de répertoire (22 octets)', async () => {
    expect((await makeZip([]).arrayBuffer()).byteLength).toBe(22);
  });

  it('relit les fichiers à l\'identique, dans l\'ordre', async () => {
    const entries = [{ name: 'a.txt', data: enc.encode('bonjour') }, { name: 'dossier/b.bin', data: Uint8Array.from([0, 255, 1, 254]) }, { name: 'vide', data: new Uint8Array(0) }];
    const got = await readZip(makeZip(entries));
    expect(got.map(g => g.name)).toEqual(['a.txt', 'dossier/b.bin', 'vide']);
    expect(got.map(g => Array.from(g.data))).toEqual(entries.map(e => Array.from(e.data)));
  });

  it('CRC-32 valide (valeurs connues : « 123456789 » → 0xCBF43926, « hello » → 0x3610A686)', async () => {
    const got = await readZip(makeZip([{ name: 'n', data: enc.encode('123456789') }, { name: 'h', data: enc.encode('hello') }]));
    expect(got[0].crc).toBe(0xcbf43926);
    expect(got[1].crc).toBe(0x3610a686);
  });

  it('noms en UTF-8 (drapeau 0x0800)', async () => {
    const got = await readZip(makeZip([{ name: 'calque_é_01.png', data: enc.encode('x') }]));
    expect(got[0].name).toBe('calque_é_01.png');
    expect(got[0].flags & 0x0800).toBe(0x0800);
  });
});
