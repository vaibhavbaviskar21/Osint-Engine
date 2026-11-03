// Phone number parsing by international calling code (longest-prefix match).

const CODES = {
  1: 'United States / Canada (NANP)', 7: 'Russia / Kazakhstan', 20: 'Egypt', 27: 'South Africa',
  30: 'Greece', 31: 'Netherlands', 32: 'Belgium', 33: 'France', 34: 'Spain', 36: 'Hungary',
  39: 'Italy', 40: 'Romania', 41: 'Switzerland', 43: 'Austria', 44: 'United Kingdom', 45: 'Denmark',
  46: 'Sweden', 47: 'Norway', 48: 'Poland', 49: 'Germany', 51: 'Peru', 52: 'Mexico', 53: 'Cuba',
  54: 'Argentina', 55: 'Brazil', 56: 'Chile', 57: 'Colombia', 58: 'Venezuela', 60: 'Malaysia',
  61: 'Australia', 62: 'Indonesia', 63: 'Philippines', 64: 'New Zealand', 65: 'Singapore',
  66: 'Thailand', 81: 'Japan', 82: 'South Korea', 84: 'Vietnam', 86: 'China', 90: 'Turkey',
  91: 'India', 92: 'Pakistan', 93: 'Afghanistan', 94: 'Sri Lanka', 95: 'Myanmar', 98: 'Iran',
  211: 'South Sudan', 212: 'Morocco', 213: 'Algeria', 216: 'Tunisia', 218: 'Libya', 220: 'Gambia',
  221: 'Senegal', 233: 'Ghana', 234: 'Nigeria', 237: 'Cameroon', 251: 'Ethiopia', 254: 'Kenya',
  255: 'Tanzania', 256: 'Uganda', 260: 'Zambia', 263: 'Zimbabwe', 351: 'Portugal', 352: 'Luxembourg',
  353: 'Ireland', 354: 'Iceland', 355: 'Albania', 356: 'Malta', 357: 'Cyprus', 358: 'Finland',
  359: 'Bulgaria', 370: 'Lithuania', 371: 'Latvia', 372: 'Estonia', 373: 'Moldova', 374: 'Armenia',
  375: 'Belarus', 380: 'Ukraine', 381: 'Serbia', 385: 'Croatia', 386: 'Slovenia', 387: 'Bosnia and Herzegovina',
  420: 'Czechia', 421: 'Slovakia', 852: 'Hong Kong', 853: 'Macau', 855: 'Cambodia', 880: 'Bangladesh',
  886: 'Taiwan', 960: 'Maldives', 961: 'Lebanon', 962: 'Jordan', 963: 'Syria', 964: 'Iraq',
  965: 'Kuwait', 966: 'Saudi Arabia', 967: 'Yemen', 968: 'Oman', 970: 'Palestine', 971: 'United Arab Emirates',
  972: 'Israel', 973: 'Bahrain', 974: 'Qatar', 975: 'Bhutan', 976: 'Mongolia', 977: 'Nepal',
  992: 'Tajikistan', 993: 'Turkmenistan', 994: 'Azerbaijan', 995: 'Georgia', 996: 'Kyrgyzstan', 998: 'Uzbekistan',
};

/**
 * Parse an international number. Numbers without a leading "+" / "00" are treated as national
 * (country unknown).
 */
export function parsePhone(raw) {
  const s = String(raw || '').trim();
  let digits = s.replace(/\D/g, '');
  const international = s.startsWith('+') || s.startsWith('00');
  if (s.startsWith('00')) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return { valid: false, input: s, digits };
  if (!international) return { valid: true, input: s, digits, international: false, national: digits, country: null, code: null };
  for (const len of [3, 2, 1]) {
    const code = digits.slice(0, len);
    if (CODES[code]) {
      return { valid: true, input: s, digits, international: true, code, country: CODES[code], national: digits.slice(len), e164: `+${digits}` };
    }
  }
  return { valid: true, input: s, digits, international: true, code: null, country: 'Unknown calling code', national: digits, e164: `+${digits}` };
}

/** Common written variants of a number — useful for quoted web searches. */
export function phoneVariants(p) {
  const n = p.national || p.digits;
  const v = new Set([n]);
  if (p.e164) {
    v.add(p.e164);
    v.add(`${p.code} ${n}`);
    v.add(`+${p.code} ${n}`);
  }
  if (n.length === 10) {
    v.add(`${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`);
    v.add(`(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`);
    v.add(`${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`);
    v.add(`${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`);
    if (p.code) v.add(`+${p.code} ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`);
  } else if (n.length > 6) {
    v.add(`${n.slice(0, n.length - 6)} ${n.slice(-6, -3)} ${n.slice(-3)}`);
  }
  if (p.code && p.code !== '1') v.add(`0${n}`);
  return [...v];
}
