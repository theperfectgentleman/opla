import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    countSegments,
    formatPhoneForDisplay,
    normalizePhone,
    parseContactsCsv,
    parseCsvRows,
    parseManualNumbers,
    renderMessage,
    summarizeContacts,
    toGsmFriendly,
} from './smsBroadcast.ts';

describe('normalizePhone', () => {
    it('collapses Ghana shapes to +233', () => {
        for (const raw of ['0244847831', '233244847831', '+233244847831', '+233 24 484 7831', '024-484-7831', '00233244847831', '+233 0244847831', '244847831']) {
            const result = normalizePhone(raw);
            assert.equal(result.ok, true, raw);
            if (result.ok) {
                assert.equal(result.e164, '+233244847831');
                assert.equal(result.isGhana, true);
            }
        }
    });

    it('accepts international numbers only with a country code', () => {
        const uk = normalizePhone('+44 7700 900123');
        assert.deepEqual(uk, { ok: true, e164: '+447700900123', isGhana: false });
        assert.equal(normalizePhone('0044 7700 900123').ok, true);
        const local = normalizePhone('7700900123');
        assert.equal(local.ok, false);
    });

    it('rejects junk with a reason', () => {
        for (const raw of ['', '   ', 'abc', '024484783', '02448478312', '+12', '1.2E+11', '0144847831', null, undefined]) {
            const result = normalizePhone(raw);
            assert.equal(result.ok, false, String(raw));
            if (!result.ok) assert.ok(result.reason.length > 0);
        }
    });

    it('formats Ghana numbers for display', () => {
        assert.equal(formatPhoneForDisplay('+233244847831'), '024 484 7831');
        assert.equal(formatPhoneForDisplay('+447700900123'), '+447700900123');
    });
});

describe('countSegments', () => {
    it('handles GSM-7 boundaries', () => {
        assert.equal(countSegments('').parts, 0);
        assert.equal(countSegments('a'.repeat(160)).parts, 1);
        assert.equal(countSegments('a'.repeat(160)).remaining, 0);
        assert.equal(countSegments('a'.repeat(161)).parts, 2);
        assert.equal(countSegments('a'.repeat(306)).parts, 2);
        assert.equal(countSegments('a'.repeat(307)).parts, 3);
    });

    it('counts extension characters twice', () => {
        const euro = countSegments('€'.repeat(80));
        assert.equal(euro.encoding, 'gsm7');
        assert.equal(euro.length, 160);
        assert.equal(countSegments('€'.repeat(81)).parts, 2);
    });

    it('switches to unicode at 70 / 67', () => {
        const info = countSegments('ɛ'.repeat(70));
        assert.equal(info.encoding, 'unicode');
        assert.equal(info.parts, 1);
        assert.deepEqual(info.unicodeChars, ['ɛ']);
        assert.equal(countSegments('ɛ'.repeat(71)).parts, 2);
        assert.equal(countSegments('ɛ'.repeat(134)).parts, 2);
        assert.equal(countSegments('ɛ'.repeat(135)).parts, 3);
        assert.equal(countSegments('Hello 👋').length, 8);
        assert.equal(countSegments('It’s').encoding, 'unicode');
    });
});

describe('toGsmFriendly', () => {
    it('turns smart punctuation back into GSM-7', () => {
        const fixed = toGsmFriendly('It’s closed — “really”…');
        assert.equal(fixed, 'It\'s closed - "really"...');
        assert.equal(countSegments(fixed).encoding, 'gsm7');
    });
});

describe('renderMessage', () => {
    it('uses the first name or a fallback', () => {
        assert.equal(renderMessage('Hi {name}, site closed', 'Ama Mensah'), 'Hi Ama, site closed');
        assert.equal(renderMessage('Hi {name}, site closed', ''), 'Hi, site closed');
        assert.equal(renderMessage('Hi {NAME}!', null, 'team'), 'Hi team!');
    });
});

describe('CSV import', () => {
    it('parses quotes, delimiters and CRLF', () => {
        assert.deepEqual(parseCsvRows('a,"b, c","d ""e"""\r\n1,2,3\r\n'), [['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
        assert.deepEqual(parseCsvRows('phone;name\n0244;Ama'), [['phone', 'name'], ['0244', 'Ama']]);
        assert.deepEqual(parseCsvRows('\uFEFFphone\tname\n0244\tAma\n\n'), [['phone', 'name'], ['0244', 'Ama']]);
    });

    it('finds phone/number/msisdn and name columns by header', () => {
        const result = parseContactsCsv('ID,Full Name,MSISDN\n1,Ama Mensah,0244000001\n2,"Kofi, Jr",233244000002\n3,Blank,\n');
        assert.equal(result.phoneColumn, 'MSISDN');
        assert.equal(result.nameColumn, 'Full Name');
        assert.equal(result.skippedBlank, 1);
        assert.deepEqual(result.contacts, [
            { phone: '0244000001', name: 'Ama Mensah', source: 'csv' },
            { phone: '233244000002', name: 'Kofi, Jr', source: 'csv' },
        ]);
        assert.equal(parseContactsCsv('name,Agent Phone\nAma,0244000001').phoneColumn, 'Agent Phone');
        assert.equal(parseContactsCsv('Number\n0244000001').contacts.length, 1);
    });

    it('falls back to the first column with or without a header row', () => {
        const noHeader = parseContactsCsv('0244000001,Ama\n0244000002,Kofi');
        assert.equal(noHeader.hasHeader, false);
        assert.equal(noHeader.contacts.length, 2);
        assert.equal(noHeader.contacts[0].name, undefined);

        const unknownHeader = parseContactsCsv('Contacts,Notes\n0244000001,x');
        assert.equal(unknownHeader.hasHeader, true);
        assert.deepEqual(unknownHeader.contacts, [{ phone: '0244000001', source: 'csv' }]);

        const nameOnlyHeader = parseContactsCsv('Name,Cell\nAma,0244000001');
        assert.equal(nameOnlyHeader.hasHeader, true);
        assert.deepEqual(nameOnlyHeader.contacts, [{ phone: '0244000001', name: 'Ama', source: 'csv' }]);
    });

    it('reports an empty file', () => {
        assert.equal(parseContactsCsv('').error, 'The file is empty');
    });
});

describe('manual numbers', () => {
    it('splits on commas, spaces and new lines but keeps spaced numbers whole', () => {
        const rows = parseManualNumbers('0244000001, 0244000002\n+233 24 400 0003; 0244000004 0244000005');
        assert.deepEqual(rows.map((r) => r.phone), ['0244000001', '0244000002', '+233 24 400 0003', '0244000004', '0244000005']);
        assert.ok(rows.every((r) => r.source === 'manual'));
    });

    it('summarises valid, unique and invalid', () => {
        const summary = summarizeContacts(parseManualNumbers('0244000001 +233244000001 nope'));
        assert.equal(summary.valid, 2);
        assert.equal(summary.unique, 1);
        assert.deepEqual(summary.invalid.map((i) => i.input), ['nope']);
    });
});
