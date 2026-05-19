import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type Base = '1' | '2';

const DATA_DIR = join(process.cwd(), 'data');

function whitelistFile(base: Base): string {
	return join(DATA_DIR, base === '2' ? 'whitelist2.json' : 'whitelist.json');
}

function ensureFile(base: Base): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
	const file = whitelistFile(base);
	if (!existsSync(file)) {
		const defaults = base === '1' ? ['0524746673'] : [];
		writeFileSync(file, JSON.stringify({ numbers: defaults }, null, 2));
	}
}

export function readWhitelist(base: Base = '1'): string[] {
	ensureFile(base);
	try {
		const raw = JSON.parse(readFileSync(whitelistFile(base), 'utf-8'));
		return Array.isArray(raw.numbers) ? raw.numbers : [];
	} catch {
		return [];
	}
}

export function writeWhitelist(base: Base, numbers: string[]): void {
	ensureFile(base);
	writeFileSync(whitelistFile(base), JSON.stringify({ numbers }, null, 2));
}

/** Returns which base a phone belongs to, or null if not whitelisted anywhere. */
export function getPhoneBase(phone: string): Base | null {
	if (readWhitelist('1').includes(phone)) return '1';
	if (readWhitelist('2').includes(phone)) return '2';
	return null;
}

export function isWhitelisted(phone: string): boolean {
	return getPhoneBase(phone) !== null;
}
