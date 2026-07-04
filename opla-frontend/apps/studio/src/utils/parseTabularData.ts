export type ParsedTabularData = {
    type: 'csv' | 'json' | 'empty';
    headers: string[];
    rows: Array<Record<string, string>>;
    error?: string;
};

function detectSeparator(line: string): string {
    const tabs = (line.match(/\t/g) || []).length;
    const commas = (line.match(/,/g) || []).length;
    return tabs > commas ? '\t' : ',';
}

export function parseTabularPaste(dataString: string, separator?: string): ParsedTabularData {
    const trimmed = (dataString || '').trim();
    if (!trimmed) {
        return { type: 'empty', headers: [], rows: [] };
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                const keysSet = new Set<string>();
                parsed.forEach((item) => {
                    if (item && typeof item === 'object') {
                        Object.keys(item).forEach((key) => keysSet.add(key));
                    }
                });
                const headers = Array.from(keysSet);
                return {
                    type: 'json',
                    headers,
                    rows: parsed
                        .filter((item) => item && typeof item === 'object')
                        .map((item) => {
                            const row: Record<string, string> = {};
                            headers.forEach((header) => {
                                row[header] = item[header] === undefined || item[header] === null ? '' : String(item[header]);
                            });
                            return row;
                        }),
                };
            }
        } catch (err: any) {
            return { type: 'json', headers: [], rows: [], error: `JSON parse error: ${err.message}` };
        }
    }

    try {
        const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
        if (lines.length === 0) {
            return { type: 'csv', headers: [], rows: [] };
        }

        const sep = separator || detectSeparator(lines[0]);
        const headers = lines[0].split(sep).map((cell) => cell.trim()).filter((cell) => cell !== '' || lines[0].split(sep).length > 1);
        const dataLines = lines.slice(1);

        const rows = dataLines.map((line) => {
            const cols = line.split(sep).map((cell) => cell.trim());
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
                row[header] = cols[index] ?? '';
            });
            return row;
        });

        return { type: 'csv', headers, rows };
    } catch (err: any) {
        return { type: 'csv', headers: [], rows: [], error: `CSV parse error: ${err.message}` };
    }
}
