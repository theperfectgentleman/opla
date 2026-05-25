const TextEncoderCtor = globalThis.TextEncoder;
const TextDecoderCtor = globalThis.TextDecoder;

function formatValue(value: unknown): string {
	if (typeof value === 'string') {
		return value;
	}

	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

export function deprecate<T extends (...args: any[]) => any>(fn: T): T {
	return fn;
}

export function format(...args: unknown[]): string {
	return args.map(formatValue).join(' ');
}

export function inspect(value: unknown): string {
	return formatValue(value);
}

export const types = {};

export const TextEncoder = TextEncoderCtor;
export const TextDecoder = TextDecoderCtor;

const browserUtil = {
	TextEncoder: TextEncoderCtor,
	TextDecoder: TextDecoderCtor,
	deprecate,
	format,
	inspect,
	types,
};

export default browserUtil;