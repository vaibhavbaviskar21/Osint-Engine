import { parseExif, sniffFileType } from '../lib/exif.js';
import { allHashes } from '../lib/hash.js';
import { isUrl } from '../lib/detect.js';
import { esc, card, kv, errorBox, empty, caseBtn, mapEmbed, link } from '../ui.js';

const SENSITIVE = ['Make', 'Model', 'BodySerialNumber', 'LensSerialNumber', 'CameraOwnerName', 'Artist', 'Software', 'HostComputer', 'DateTimeOriginal'];

function fmtVal(k, v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? +x.toFixed(6) : x)).join(', ');
  if (k === 'ExposureTime' && typeof v === 'number' && v < 1 && v > 0) return `1/${Math.round(1 / v)} s`;
  if (k === 'FNumber' && typeof v === 'number') return `f/${v.toFixed(1)}`;
  if (k === 'FocalLength' && typeof v === 'number') return `${v} mm`;
  if (typeof v === 'number') return String(+v.toFixed(6));
  return v;
}

function table(obj) {
  const rows = Object.entries(obj).map(([k, v]) => [k, fmtVal(k, v)]);
  return rows.length ? kv(rows) : empty('None.');
}

function reverseLinks(url) {
  const e = encodeURIComponent(url);
  return `<div class="pivots">
    ${link(`https://lens.google.com/uploadbyurl?url=${e}`, 'Google Lens ↗')}
    ${link(`https://tineye.com/search?url=${e}`, 'TinEye ↗')}
    ${link(`https://yandex.com/images/search?rpt=imageview&url=${e}`, 'Yandex ↗')}
    ${link(`https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${e}`, 'Bing ↗')}
  </div>`;
}

async function analyseFile(root, file) {
  const res = root.querySelector('#results');
  res.innerHTML = '<div class="loading"><span class="spinner"></span>Analysing locally…</div>';
  try {
    const buf = await file.arrayBuffer();
    const [hashes, dims] = await Promise.all([
      allHashes(buf),
      new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight, url }); };
        img.onerror = () => resolve({ url: null });
        img.src = url;
      }),
    ]);
    let exif = null;
    let exifErr = null;
    try {
      exif = parseExif(buf);
    } catch (err) {
      exifErr = err.message;
    }
    const found = exif ? SENSITIVE.filter((k) => exif.ifd0[k] || exif.exif[k]) : [];
    const loc = exif?.location;
    res.innerHTML = `
      <div class="grid two">
        ${card('File', `${dims.url ? `<img class="preview" src="${dims.url}" alt="Preview" />` : ''}
          ${kv([
            ['Name', file.name],
            ['Detected type', sniffFileType(buf)],
            ['Declared MIME', file.type || 'unknown'],
            ['Size', `${file.size.toLocaleString()} bytes`],
            ['Dimensions', dims.w ? `${dims.w} × ${dims.h}px` : null],
            ['Last modified', file.lastModified ? new Date(file.lastModified).toISOString() : null],
          ])}`)}
        ${card('Privacy summary', `
          <ul class="flags">
            ${loc ? '<li class="bad">GPS coordinates embedded — reveals where the photo was taken.</li>' : '<li class="good">No GPS coordinates found.</li>'}
            ${found.length ? `<li class="warn">Identifying metadata present: ${esc(found.join(', '))}</li>` : '<li class="good">No camera / owner identifiers found.</li>'}
            ${exif ? '' : `<li class="info">${esc(exifErr || 'No EXIF block — metadata may have been stripped (common on social media uploads).')}</li>`}
          </ul>
          <h4>Hashes</h4>
          ${kv(Object.entries(hashes).map(([k, v]) => [k.toUpperCase(), v, { copy: true }]))}
          <p>${caseBtn('hash', hashes.sha256, `SHA-256 of ${file.name}`)} <a href="#/toolkit">More hash tools →</a></p>`)}
      </div>
      ${loc ? card('Location', `${kv([['Latitude', loc.lat, { copy: true }], ['Longitude', loc.lon, { copy: true }], ['Altitude', loc.alt != null ? `${loc.alt.toFixed(1)} m` : null]])}
          <p>${caseBtn('location', `${loc.lat}, ${loc.lon}`, `GPS from ${file.name}`)}</p>${mapEmbed(loc.lat, loc.lon, 0.01)}`) : ''}
      ${exif ? `<div class="grid two">
        ${card('Camera & image (IFD0)', table(exif.ifd0))}
        ${card('Capture settings (EXIF)', table(exif.exif))}
      </div>
      ${Object.keys(exif.gps).length ? card('GPS tags', table(exif.gps)) : ''}` : ''}
      ${card('Reverse image search', `<p class="muted">Search engines need the image to be reachable by URL, or uploaded on their site:</p>
        <div class="pivots">
          ${link('https://lens.google.com/', 'Google Lens ↗')} ${link('https://tineye.com/', 'TinEye ↗')}
          ${link('https://yandex.com/images/', 'Yandex ↗')} ${link('https://www.bing.com/visualsearch', 'Bing ↗')}
          ${link('https://fotoforensics.com/', 'FotoForensics (ELA) ↗')} ${link('https://29a.ch/photo-forensics/', 'Forensically ↗')}
        </div>`)}
    `;
  } catch (err) {
    res.innerHTML = errorBox(err.message);
  }
}

export function render(root) {
  root.innerHTML = `
    <div class="page-h"><h1>Image Forensics</h1>
      <p class="muted">Extract EXIF metadata and GPS location, fingerprint the file, and launch reverse image searches.
      <strong>Files are processed entirely in your browser and never uploaded.</strong></p></div>
    <label class="dropzone" id="drop">
      <input type="file" id="file" accept="image/*,.jpg,.jpeg,.png,.heic,.tif,.tiff,.webp" hidden />
      <span class="tile-i">🖼️</span>
      <strong>Drop an image here, or click to choose</strong>
      <span class="muted">JPEG files carry the richest EXIF data · you can also paste from clipboard</span>
    </label>
    ${card('Reverse search by image URL', `<form class="search-row" id="urlForm"><input class="input" id="imgUrl" placeholder="https://example.com/photo.jpg" />
      <button class="btn" type="submit">Build links</button></form><div id="urlOut"></div>`)}
    <div id="results" class="results"></div>`;
  const input = root.querySelector('#file');
  const drop = root.querySelector('#drop');
  input.addEventListener('change', () => input.files[0] && analyseFile(root, input.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && analyseFile(root, e.dataTransfer.files[0]));
  const onPaste = (e) => {
    if (!root.isConnected) return document.removeEventListener('paste', onPaste);
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) analyseFile(root, f);
  };
  document.addEventListener('paste', onPaste);
  root.querySelector('#urlForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = root.querySelector('#imgUrl').value.trim();
    root.querySelector('#urlOut').innerHTML = isUrl(u) ? reverseLinks(u) : errorBox('Enter a full http(s) image URL.');
  });
}
