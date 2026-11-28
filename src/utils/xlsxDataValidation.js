/**
 * Utilitas Injeksi Native OOXML Excel Data Validation (Dropdown List)
 * Memodifikasi buffer .xlsx hasil SheetJS secara presisi untuk menyisipkan elemen <dataValidations>
 * ke xl/worksheets/sheet1.xml sesuai standar ECMA-376 agar dropdown muncul langsung di
 * Microsoft Excel, Google Sheets, LibreOffice Calc, dan WPS Office.
 */
import * as XLSX from 'xlsx';

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function readUint16LE(buf, offset) {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUint32LE(buf, offset) {
  return (
    (buf[offset] |
      (buf[offset + 1] << 8) |
      (buf[offset + 2] << 16) |
      (buf[offset + 3] << 24)) >>>
    0
  );
}

function writeUint16LE(arr, offset, val) {
  arr[offset] = val & 0xff;
  arr[offset + 1] = (val >>> 8) & 0xff;
}

function writeUint32LE(arr, offset, val) {
  arr[offset] = val & 0xff;
  arr[offset + 1] = (val >>> 8) & 0xff;
  arr[offset + 2] = (val >>> 16) & 0xff;
  arr[offset + 3] = (val >>> 24) & 0xff;
}

async function runCompressionStream(bytes, mode) {
  const StreamCtor = mode === 'compress' ? CompressionStream : DecompressionStream;
  const stream = new StreamCtor('deflate-raw');
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = stream.readable.getReader();
  const chunks = [];
  let totalLen = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const ch of chunks) {
    out.set(ch, pos);
    pos += ch.length;
  }
  return out;
}

function escapeXmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Parse ZIP entries dari End-Of-Central-Directory (EOCD)
 */
function parseZipEntries(zipBytes) {
  let eocdOffset = -1;
  const minOffset = Math.max(0, zipBytes.length - 65557);
  for (let i = zipBytes.length - 22; i >= minOffset; i--) {
    if (
      zipBytes[i] === 0x50 &&
      zipBytes[i + 1] === 0x4b &&
      zipBytes[i + 2] === 0x05 &&
      zipBytes[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error('Archive XLSX tidak valid (EOCD tidak ditemukan).');
  }

  const totalEntries = readUint16LE(zipBytes, eocdOffset + 10);
  const cdOffset = readUint32LE(zipBytes, eocdOffset + 16);
  const decoder = new TextDecoder('utf-8');
  const entries = [];
  let ptr = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (readUint32LE(zipBytes, ptr) !== 0x02014b50) {
      throw new Error('Header Central Directory ZIP rusak.');
    }
    const method = readUint16LE(zipBytes, ptr + 10);
    const modTime = readUint16LE(zipBytes, ptr + 12);
    const modDate = readUint16LE(zipBytes, ptr + 14);
    const entryCrc = readUint32LE(zipBytes, ptr + 16);
    const compSize = readUint32LE(zipBytes, ptr + 20);
    const uncompSize = readUint32LE(zipBytes, ptr + 24);
    const nameLen = readUint16LE(zipBytes, ptr + 28);
    const extraLen = readUint16LE(zipBytes, ptr + 30);
    const commentLen = readUint16LE(zipBytes, ptr + 32);
    const localHeaderOffset = readUint32LE(zipBytes, ptr + 42);
    const nameBytes = zipBytes.subarray(ptr + 46, ptr + 46 + nameLen);
    const name = decoder.decode(nameBytes);

    const localNameLen = readUint16LE(zipBytes, localHeaderOffset + 26);
    const localExtraLen = readUint16LE(zipBytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const rawCompressed = zipBytes.subarray(dataStart, dataStart + compSize);

    entries.push({
      name,
      method,
      modTime,
      modDate,
      crc: entryCrc,
      compSize,
      uncompSize,
      rawCompressed: new Uint8Array(rawCompressed)
    });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/**
 * Bangun kembali file ZIP dari daftar entries
 */
function buildZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.rawCompressed;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20); // version needed
    writeUint16LE(localHeader, 6, 0); // flags
    writeUint16LE(localHeader, 8, entry.method);
    writeUint16LE(localHeader, 10, entry.modTime || 0);
    writeUint16LE(localHeader, 12, entry.modDate || 0x5421);
    writeUint32LE(localHeader, 14, entry.crc);
    writeUint32LE(localHeader, 18, data.length);
    writeUint32LE(localHeader, 22, entry.uncompSize);
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const cdHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(cdHeader, 0, 0x02014b50);
    writeUint16LE(cdHeader, 4, 20); // version made by
    writeUint16LE(cdHeader, 6, 20); // version needed
    writeUint16LE(cdHeader, 8, 0);
    writeUint16LE(cdHeader, 10, entry.method);
    writeUint16LE(cdHeader, 12, entry.modTime || 0);
    writeUint16LE(cdHeader, 14, entry.modDate || 0x5421);
    writeUint32LE(cdHeader, 16, entry.crc);
    writeUint32LE(cdHeader, 20, data.length);
    writeUint32LE(cdHeader, 24, entry.uncompSize);
    writeUint16LE(cdHeader, 28, nameBytes.length);
    writeUint16LE(cdHeader, 30, 0);
    writeUint16LE(cdHeader, 32, 0);
    writeUint16LE(cdHeader, 34, 0);
    writeUint16LE(cdHeader, 36, 0);
    writeUint32LE(cdHeader, 38, 0);
    writeUint32LE(cdHeader, 42, offset);
    cdHeader.set(nameBytes, 46);

    cdParts.push(cdHeader);
    offset += localHeader.length + data.length;
  }

  let cdSize = 0;
  for (const p of cdParts) cdSize += p.length;

  const eocd = new Uint8Array(22);
  writeUint32LE(eocd, 0, 0x06054b50);
  writeUint16LE(eocd, 4, 0);
  writeUint16LE(eocd, 6, 0);
  writeUint16LE(eocd, 8, entries.length);
  writeUint16LE(eocd, 10, entries.length);
  writeUint32LE(eocd, 12, cdSize);
  writeUint32LE(eocd, 16, offset);
  writeUint16LE(eocd, 20, 0);

  const totalSize = offset + cdSize + 22;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of localParts) {
    result.set(p, pos);
    pos += p.length;
  }
  for (const p of cdParts) {
    result.set(p, pos);
    pos += p.length;
  }
  result.set(eocd, pos);
  return result;
}

/**
 * Bangun XML <dataValidations> sesuai urutan skema ECMA-376
 * Catatan penting OOXML: atribut showDropDown TIDAK diset "1" (di Excel showDropDown="1" justru menyembunyikan panah!).
 */
function buildDataValidationsXml(validations) {
  if (!Array.isArray(validations) || validations.length === 0) return '';
  const itemsXml = validations
    .map((v) => {
      const sqref = escapeXmlAttr(v.sqref);
      const errorStyle = escapeXmlAttr(v.errorStyle || 'warning'); // 'stop' | 'warning' | 'information'
      const allowBlank = v.allowBlank !== false ? '1' : '0';
      const promptTitle = v.promptTitle ? ` promptTitle="${escapeXmlAttr(v.promptTitle)}"` : '';
      const prompt = v.prompt ? ` prompt="${escapeXmlAttr(v.prompt)}"` : '';
      const errorTitle = v.errorTitle ? ` errorTitle="${escapeXmlAttr(v.errorTitle)}"` : '';
      const errorMsg = v.error ? ` error="${escapeXmlAttr(v.error)}"` : '';
      const showInput = v.prompt || v.promptTitle ? ' showInputMessage="1"' : '';
      const showError = v.error || v.errorTitle ? ' showErrorMessage="1"' : '';

      let formulaBody = '';
      if (v.formulaRef) {
        formulaBody = escapeXmlText(v.formulaRef);
      } else if (Array.isArray(v.options)) {
        const cleanOpts = v.options.map((o) => String(o).replace(/"/g, "'").trim()).filter(Boolean);
        formulaBody = escapeXmlText(`"${cleanOpts.join(',')}"`);
      }

      return `<dataValidation type="list" allowBlank="${allowBlank}" errorStyle="${errorStyle}"${showInput}${showError}${promptTitle}${prompt}${errorTitle}${errorMsg} sqref="${sqref}"><formula1>${formulaBody}</formula1></dataValidation>`;
    })
    .join('');

  return `<dataValidations count="${validations.length}">${itemsXml}</dataValidations>`;
}

/**
 * Sisipkan <dataValidations> ke sheet XML sebelum elemen penutup/trailing ECMA-376
 */
function injectValidationsIntoSheetXml(sheetXml, validationsXml) {
  if (!validationsXml) return sheetXml;

  // Hapus blok dataValidations lama jika ada
  let cleaned = sheetXml.replace(/<dataValidations\b[^>]*>[\s\S]*?<\/dataValidations>/g, '');

  const trailingTags = [
    '<hyperlinks',
    '<printOptions',
    '<pageMargins',
    '<pageSetup',
    '<headerFooter',
    '<rowBreaks',
    '<colBreaks',
    '<customProperties',
    '<cellWatches',
    '<ignoredErrors',
    '<smartTags',
    '<drawing',
    '<legacyDrawing',
    '<extLst',
    '</worksheet>'
  ];

  let insertIdx = -1;
  for (const tag of trailingTags) {
    const idx = cleaned.indexOf(tag);
    if (idx !== -1 && (insertIdx === -1 || idx < insertIdx)) {
      insertIdx = idx;
    }
  }

  if (insertIdx === -1) {
    return cleaned;
  }

  return cleaned.slice(0, insertIdx) + validationsXml + cleaned.slice(insertIdx);
}

/**
 * Hasilkan Uint8Array file .xlsx dengan dropdown validasi tertanam pada sheet target (default: sheet1.xml)
 */
export async function generateWorkbookBufferWithValidations(wb, validationsBySheet = {}) {
  const rawArr = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const zipBytes = rawArr instanceof Uint8Array ? rawArr : new Uint8Array(rawArr);
  const entries = parseZipEntries(zipBytes);
  const decoder = new TextDecoder('utf-8');
  const encoder = new TextEncoder();

  for (const entry of entries) {
    const validations = validationsBySheet[entry.name];
    if (!validations || validations.length === 0) continue;

    let xmlBytes;
    if (entry.method === 0) {
      xmlBytes = entry.rawCompressed;
    } else if (entry.method === 8) {
      xmlBytes = await runCompressionStream(entry.rawCompressed, 'decompress');
    } else {
      continue;
    }

    const originalXml = decoder.decode(xmlBytes);
    const dvXml = buildDataValidationsXml(validations);
    const updatedXml = injectValidationsIntoSheetXml(originalXml, dvXml);
    const updatedBytes = encoder.encode(updatedXml);

    entry.crc = crc32(updatedBytes);
    entry.uncompSize = updatedBytes.length;

    if (typeof CompressionStream !== 'undefined') {
      entry.rawCompressed = await runCompressionStream(updatedBytes, 'compress');
      entry.method = 8;
      entry.compSize = entry.rawCompressed.length;
    } else {
      entry.rawCompressed = updatedBytes;
      entry.method = 0;
      entry.compSize = updatedBytes.length;
    }
  }

  return buildZip(entries);
}

/**
 * Unduh workbook sebagai file .xlsx di browser dengan fallback SheetJS murni jika terjadi kendala
 */
export async function downloadWorkbookWithValidations(wb, filename, validationsBySheet = {}) {
  try {
    const xlsxBytes = await generateWorkbookBufferWithValidations(wb, validationsBySheet);
    const blob = new Blob([xlsxBytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.warn('Fallback ke unduhan XLSX standar:', err);
    XLSX.writeFile(wb, filename);
  }
}
