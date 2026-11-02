// Minimal, dependency-free EXIF reader for JPEG files (runs fully in-browser).

const IFD0_TAGS = {
  0x010e: 'ImageDescription', 0x010f: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
  0x011a: 'XResolution', 0x011b: 'YResolution', 0x0128: 'ResolutionUnit', 0x0131: 'Software',
  0x0132: 'DateTime', 0x013b: 'Artist', 0x013c: 'HostComputer', 0x8298: 'Copyright',
  0x8769: 'ExifIFDPointer', 0x8825: 'GPSInfoIFDPointer',
};

const EXIF_TAGS = {
  0x829a: 'ExposureTime', 0x829d: 'FNumber', 0x8822: 'ExposureProgram', 0x8827: 'ISOSpeedRatings',
  0x9000: 'ExifVersion', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
  0x9010: 'OffsetTime', 0x9011: 'OffsetTimeOriginal', 0x9012: 'OffsetTimeDigitized',
  0x9201: 'ShutterSpeedValue', 0x9202: 'ApertureValue', 0x9204: 'ExposureBias',
  0x9207: 'MeteringMode', 0x9209: 'Flash', 0x920a: 'FocalLength', 0x9286: 'UserComment',
  0x9290: 'SubSecTime', 0x9291: 'SubSecTimeOriginal', 0xa001: 'ColorSpace',
  0xa002: 'PixelXDimension', 0xa003: 'PixelYDimension', 0xa402: 'ExposureMode',
  0xa403: 'WhiteBalance', 0xa405: 'FocalLengthIn35mmFilm', 0xa406: 'SceneCaptureType',
  0xa420: 'ImageUniqueID', 0xa430: 'CameraOwnerName', 0xa431: 'BodySerialNumber',
  0xa432: 'LensSpecification', 0xa433: 'LensMake', 0xa434: 'LensModel', 0xa435: 'LensSerialNumber',
};

const GPS_TAGS = {
  0x0000: 'GPSVersionID', 0x0001: 'GPSLatitudeRef', 0x0002: 'GPSLatitude', 0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude', 0x0005: 'GPSAltitudeRef', 0x0006: 'GPSAltitude', 0x0007: 'GPSTimeStamp',
  0x0008: 'GPSSatellites', 0x000c: 'GPSSpeedRef', 0x000d: 'GPSSpeed', 0x0010: 'GPSImgDirectionRef',
  0x0011: 'GPSImgDirection', 0x0012: 'GPSMapDatum', 0x001b: 'GPSProcessingMethod', 0x001d: 'GPSDateStamp',
};

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readString(view, start, len) {
  let s = '';
  for (let i = 0; i < len && start + i < view.byteLength; i++) {
    const c = view.getUint8(start + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function readValue(view, type, offset, count, little) {
  const vals = [];
  for (let i = 0; i < count; i++) {
    switch (type) {
      case 1: case 7: vals.push(view.getUint8(offset + i)); break;
      case 3: vals.push(view.getUint16(offset + i * 2, little)); break;
      case 4: vals.push(view.getUint32(offset + i * 4, little)); break;
      case 9: vals.push(view.getInt32(offset + i * 4, little)); break;
      case 5: case 10: {
        const get = type === 5 ? 'getUint32' : 'getInt32';
        const num = view[get](offset + i * 8, little);
        const den = view[get](offset + i * 8 + 4, little);
        vals.push(den === 0 ? 0 : num / den);
        break;
      }
      default: return null;
    }
  }
  return count === 1 ? vals[0] : vals;
}

function readIFD(view, tiffStart, dirStart, little, tagNames) {
  const out = {};
  if (dirStart + 2 > view.byteLength) return out;
  const entries = view.getUint16(dirStart, little);
  for (let i = 0; i < entries; i++) {
    const entry = dirStart + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const count = view.getUint32(entry + 4, little);
    const size = TYPE_SIZE[type];
    if (!size) continue;
    const total = size * count;
    const dataOffset = total <= 4 ? entry + 8 : tiffStart + view.getUint32(entry + 8, little);
    if (dataOffset + total > view.byteLength) continue;
    const name = tagNames[tag] || `Tag0x${tag.toString(16).padStart(4, '0')}`;
    let value;
    if (type === 2) value = readString(view, dataOffset, count).trim();
    else if (type === 7 && count > 4) {
      // UNDEFINED blobs: UserComment has an 8-byte charset prefix.
      value = name === 'UserComment' ? readString(view, dataOffset + 8, count - 8).trim() : `<${count} bytes>`;
    } else value = readValue(view, type, dataOffset, count, little);
    out[name] = value;
  }
  return out;
}

export function dmsToDecimal(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return null;
  let dec = dms[0] + dms[1] / 60 + dms[2] / 3600;
  if (ref === 'S' || ref === 'W') dec = -dec;
  return Math.round(dec * 1e7) / 1e7;
}

function parseTiff(view, start) {
  const order = view.getUint16(start);
  const little = order === 0x4949;
  if (!little && order !== 0x4d4d) throw new Error('Invalid TIFF byte order');
  if (view.getUint16(start + 2, little) !== 42) throw new Error('Invalid TIFF marker');
  const ifd0Offset = view.getUint32(start + 4, little);
  const ifd0 = readIFD(view, start, start + ifd0Offset, little, IFD0_TAGS);
  const exif = ifd0.ExifIFDPointer ? readIFD(view, start, start + ifd0.ExifIFDPointer, little, EXIF_TAGS) : {};
  const gps = ifd0.GPSInfoIFDPointer ? readIFD(view, start, start + ifd0.GPSInfoIFDPointer, little, GPS_TAGS) : {};
  delete ifd0.ExifIFDPointer;
  delete ifd0.GPSInfoIFDPointer;

  let location = null;
  const lat = dmsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
  const lon = dmsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);
  if (lat !== null && lon !== null && !(lat === 0 && lon === 0)) {
    location = { lat, lon };
    if (typeof gps.GPSAltitude === 'number') location.alt = gps.GPSAltitudeRef === 1 ? -gps.GPSAltitude : gps.GPSAltitude;
  }
  return { byteOrder: little ? 'Intel (II)' : 'Motorola (MM)', ifd0, exif, gps, location };
}

/**
 * Parse EXIF from a JPEG ArrayBuffer.
 * @returns {null | {ifd0, exif, gps, location, byteOrder}} null when the JPEG has no EXIF block.
 */
export function parseExif(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) throw new Error('Not a JPEG file (EXIF parsing supports JPEG)');
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00) break;
    if (marker === 0xffda || marker === 0xffd9) break; // start of scan / end of image
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && readString(view, offset + 4, 4) === 'Exif') {
      return parseTiff(view, offset + 10);
    }
    offset += 2 + size;
  }
  return null;
}

/** Simple file-type sniffing by magic bytes. */
export function sniffFileType(buffer) {
  const b = new Uint8Array(buffer.slice(0, 16));
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  const sigs = [
    ['ffd8ff', 'JPEG image'], ['89504e47', 'PNG image'], ['47494638', 'GIF image'],
    ['25504446', 'PDF document'], ['504b0304', 'ZIP archive (also DOCX/XLSX/APK)'],
    ['52494646', 'RIFF container (WEBP/WAV/AVI)'], ['49492a00', 'TIFF image (LE)'],
    ['4d4d002a', 'TIFF image (BE)'], ['424d', 'BMP image'], ['7f454c46', 'ELF executable'],
    ['4d5a', 'Windows PE executable'], ['1f8b', 'GZIP archive'], ['377abcaf', '7-Zip archive'],
    ['52617221', 'RAR archive'],
  ];
  for (const [sig, name] of sigs) if (hex.startsWith(sig)) return name;
  if (hex.slice(8, 16) === '66747970') return 'ISO media (MP4/MOV/HEIC)';
  return 'Unknown';
}
