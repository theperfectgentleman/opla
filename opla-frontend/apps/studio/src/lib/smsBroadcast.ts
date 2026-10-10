/**
 * Pure helpers for Messages → Broadcasts (SMS). No React, axios or Vite, so node:test can import it.
 * Phone rules and segment maths mirror opla-backend/app/services/sms/{phone,segments}.py.
 * The API is authoritative; these give instant feedback while typing or importing a CSV.
 */

// ---------------------------------------------------------------- phones

export type PhoneResult =
    | { ok: true; e164: string; isGhana: boolean }
    | { ok: false; reason: string };

const SEPARATORS = /[\s\-.()/]/g;
const E164 = /^\+[1-9]\d{7,14}$/;
const GHANA_NATIONAL = /^[2-5]\d{8}$/;

function ghana(national: string): PhoneResult {
    if (!GHANA_NATIONAL.test(national)) {
        return { ok: false, reason: 'Not a valid Ghana number (expected 0XXXXXXXXX or +233XXXXXXXXX)' };
    }
    return { ok: true, e164: `+233${national}`, isGhana: true };
}

/**
 * Ghana numbers (0244…, 233244…, +233244…, +233 0244…, 00233…, or 9 digits that lost their 0 in Excel)
 * become +233XXXXXXXXX. Other countries need an explicit + or 00 country code.
 */
export function normalizePhone(raw: unknown): PhoneResult {
    const text = raw == null ? '' : String(raw).trim();
    if (!text) return { ok: false, reason: 'Missing phone number' };

    let compact = text.replace(SEPARATORS, '');
    if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
    const hasPlus = compact.startsWith('+');
    const digits = hasPlus ? compact.slice(1) : compact;
    if (!/^\d+$/.test(digits)) return { ok: false, reason: 'Phone number contains letters or symbols' };

    if (digits.startsWith('233')) {
        let rest = digits.slice(3);
        if (rest.length === 10 && rest.startsWith('0')) rest = rest.slice(1);
        if (rest.length !== 9) return { ok: false, reason: 'Ghana numbers need 9 digits after 233' };
        return ghana(rest);
    }
    if (hasPlus) {
        const e164 = `+${digits}`;
        return E164.test(e164) ? { ok: true, e164, isGhana: false } : { ok: false, reason: 'Not a valid international number' };
    }
    if (digits.length === 10 && digits.startsWith('0')) return ghana(digits.slice(1));
    if (digits.length === 9) return ghana(digits);
    if (digits.startsWith('0')) return { ok: false, reason: 'Ghana numbers starting with 0 must have 10 digits' };
    return { ok: false, reason: 'Add a country code (for example +44…) for numbers outside Ghana' };
}

/** +233244847831 → 024 484 7831 for display; other numbers are returned unchanged. */
export function formatPhoneForDisplay(e164: string): string {
    const match = /^\+233(\d{2})(\d{3})(\d{4})$/.exec(e164);
    return match ? `0${match[1]} ${match[2]} ${match[3]}` : e164;
}

// ---------------------------------------------------------------- segments

const GSM7_BASIC = new Set(
    Array.from(
        '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?'
        + '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
    ),
);
const GSM7_EXTENDED = new Set(Array.from('^{}\\[~]|€\f'));

export type SegmentInfo = {
    encoding: 'gsm7' | 'unicode';
    length: number;
    parts: number;
    perPart: number;
    remaining: number;
    /** Characters that forced unicode, so the UI can point them out. */
    unicodeChars: string[];
};

/**
 * 160 GSM-7 characters fit one SMS; longer messages use 153 per part.
 * Any other character switches the whole message to unicode: 70 in one part, 67 per part after that.
 */
export function countSegments(text: string): SegmentInfo {
    const chars = Array.from(text || '');
    const unicodeChars = Array.from(new Set(chars.filter((ch) => !GSM7_BASIC.has(ch) && !GSM7_EXTENDED.has(ch))));
    let length: number;
    let single: number;
    let multi: number;
    let encoding: SegmentInfo['encoding'];
    if (unicodeChars.length === 0) {
        length = chars.reduce((sum, ch) => sum + (GSM7_EXTENDED.has(ch) ? 2 : 1), 0);
        single = 160;
        multi = 153;
        encoding = 'gsm7';
    } else {
        length = (text || '').length; // UTF-16 code units, like UCS-2 on the network
        single = 70;
        multi = 67;
        encoding = 'unicode';
    }
    if (length === 0) return { encoding, length, parts: 0, perPart: single, remaining: single, unicodeChars };
    if (length <= single) return { encoding, length, parts: 1, perPart: single, remaining: single - length, unicodeChars };
    const parts = Math.ceil(length / multi);
    return { encoding, length, parts, perPart: multi, remaining: parts * multi - length, unicodeChars };
}

const GSM_LOOKALIKES: Record<string, string> = {
    '\u2014': '-', // em dash
    '\u2013': '-', // en dash
    '\u2018': "'",
    '\u2019': "'",
    '\u201C': '"',
    '\u201D': '"',
    '\u2026': '...',
    '\u00A0': ' ',
    '\u2022': '-',
};

/** Swap smart punctuation (often pasted from Word/WhatsApp) for GSM-7 equivalents so the SMS stays at 160/part. */
export function toGsmFriendly(text: string): string {
    return Array.from(text || '').map((ch) => GSM_LOOKALIKES[ch] ?? ch).join('');
}

export function hasGsmLookalikes(text: string): boolean {
    return Array.from(text || '').some((ch) => ch in GSM_LOOKALIKES);
}

// ---------------------------------------------------------------- {name}

const NAME_TOKEN = /\{\s*name\s*\}/gi;

export function hasNameToken(message: string): boolean {
    return /\{\s*name\s*\}/i.test(message || '');
}

export function renderMessage(template: string, name?: string | null, fallback = ''): string {
    if (!hasNameToken(template)) return template;
    const first = (name || '').trim().split(/\s+/)[0] || '';
    const value = first || fallback.trim();
    let rendered = template.replace(NAME_TOKEN, value);
    if (!value) {
        rendered = rendered.replace(/[ \t]+([,.!?])/g, '$1').replace(/[ \t]{2,}/g, ' ');
    }
    return rendered.trim();
}

// ---------------------------------------------------------------- CSV / manual input

export type ContactRow = { phone: string; name?: string; source: 'csv' | 'manual' };

export type CsvImportResult = {
    contacts: ContactRow[];
    phoneColumn: string | null;
    nameColumn: string | null;
    hasHeader: boolean;
    skippedBlank: number;
    error?: string;
};

/** RFC 4180-ish: quoted fields, doubled quotes, commas/semicolons/tabs, CRLF. */
export function parseCsvRows(text: string): string[][] {
    const source = (text || '').replace(/^\uFEFF/, '');
    const firstLine = source.split(/\r?\n/, 1)[0] || '';
    const counts: Array<[string, number]> = [',', ';', '\t'].map((sep) => [sep, firstLine.split(sep).length - 1]);
    counts.sort((a, b) => b[1] - a[1]);
    const delimiter = counts[0][1] > 0 ? counts[0][0] : ',';

    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < source.length; i += 1) {
        const ch = source[i];
        if (inQuotes) {
            if (ch === '"') {
                if (source[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                field += ch;
            }
            continue;
        }
        if (ch === '"' && field.trim() === '') {
            inQuotes = true;
            field = '';
        } else if (ch === delimiter) {
            row.push(field.trim());
            field = '';
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && source[i + 1] === '\n') i += 1;
            row.push(field.trim());
            rows.push(row);
            row = [];
            field = '';
        } else {
            field += ch;
        }
    }
    if (field !== '' || row.length > 0) {
        row.push(field.trim());
        rows.push(row);
    }
    return rows.filter((cells) => cells.some((cell) => cell !== ''));
}

const PHONE_HEADERS = ['phone', 'phone number', 'phone_number', 'phonenumber', 'number', 'mobile', 'mobile number', 'msisdn', 'tel', 'telephone', 'contact', 'whatsapp'];
const NAME_HEADERS = ['name', 'full name', 'full_name', 'fullname', 'first name', 'first_name', 'firstname', 'contact name'];

function headerKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeader(headers: string[], candidates: string[]): number {
    const keys = headers.map(headerKey);
    for (const candidate of candidates) {
        const exact = keys.indexOf(candidate);
        if (exact >= 0) return exact;
    }
    // "Agent phone", "Phone (MTN)", "msisdn_1" …
    return keys.findIndex((key) => candidates.some((candidate) => key.split(/[^a-z]+/).includes(candidate)));
}

/**
 * Phone column: any header named phone / number / msisdn / mobile (etc.), otherwise the first column.
 * Name column: optional, any header named name / full name / first name.
 * A first row whose phone cell is not a phone number is treated as a header row.
 */
export function parseContactsCsv(text: string): CsvImportResult {
    const rows = parseCsvRows(text);
    if (rows.length === 0) {
        return { contacts: [], phoneColumn: null, nameColumn: null, hasHeader: false, skippedBlank: 0, error: 'The file is empty' };
    }
    const first = rows[0];
    let phoneIndex = findHeader(first, PHONE_HEADERS);
    let nameIndex = findHeader(first, NAME_HEADERS);
    if (nameIndex === phoneIndex) nameIndex = -1;
    let hasHeader = phoneIndex >= 0 || nameIndex >= 0;
    if (!hasHeader) {
        phoneIndex = 0;
        // No recognised header: if the first cell is clearly text (e.g. "Contacts"), still skip it.
        hasHeader = !normalizePhone(first[0]).ok && /[a-z]/i.test(first[0] || '');
    } else if (phoneIndex < 0) {
        // Header row with a name column but no recognised phone header: first other column.
        phoneIndex = nameIndex === 0 && first.length > 1 ? 1 : 0;
        if (nameIndex === phoneIndex) nameIndex = -1;
    }
    const dataRows = hasHeader ? rows.slice(1) : rows;
    let skippedBlank = 0;
    const contacts: ContactRow[] = [];
    for (const cells of dataRows) {
        const phone = (cells[phoneIndex] || '').trim();
        if (!phone) {
            skippedBlank += 1;
            continue;
        }
        const name = nameIndex >= 0 ? (cells[nameIndex] || '').trim() : '';
        contacts.push(name ? { phone, name, source: 'csv' } : { phone, source: 'csv' });
    }
    return {
        contacts,
        phoneColumn: hasHeader ? first[phoneIndex] || null : null,
        nameColumn: hasHeader && nameIndex >= 0 ? first[nameIndex] || null : null,
        hasHeader,
        skippedBlank,
    };
}

/** Typed/pasted numbers separated by commas, semicolons, spaces or new lines. "+233 24 484 7831" stays one number. */
export function parseManualNumbers(text: string): ContactRow[] {
    const tokens = (text || '')
        .split(/[,;\n\r]+/)
        .flatMap((chunk) => {
            const trimmed = chunk.trim();
            if (!trimmed) return [];
            // A chunk that is a phone with internal spaces is one number; otherwise split on spaces.
            if (normalizePhone(trimmed).ok) return [trimmed];
            return trimmed.split(/\s+/);
        })
        .map((token) => token.trim())
        .filter(Boolean);
    return tokens.map((phone) => ({ phone, source: 'manual' as const }));
}

export type LocalSummary = { valid: number; invalid: Array<{ input: string; reason: string }>; unique: number };

export function summarizeContacts(contacts: ContactRow[]): LocalSummary {
    const seen = new Set<string>();
    const invalid: LocalSummary['invalid'] = [];
    let valid = 0;
    for (const contact of contacts) {
        const parsed = normalizePhone(contact.phone);
        if (!parsed.ok) {
            invalid.push({ input: contact.phone, reason: parsed.reason });
            continue;
        }
        valid += 1;
        seen.add(parsed.e164);
    }
    return { valid, invalid, unique: seen.size };
}
