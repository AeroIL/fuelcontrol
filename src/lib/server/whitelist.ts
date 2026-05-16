import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const WHITELIST_FILE = join(DATA_DIR, 'whitelist.json');

function ensureFile(): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
	if (!existsSync(WHITELIST_FILE)) {
		writeFileSync(WHITELIST_FILE, JSON.stringify({ numbers: ['0524746673'] }, null, 2));
	}
}

export function readWhitelist(): string[] {
	ensureFile();
	try {
		const raw = JSON.parse(readFileSync(WHITELIST_FILE, 'utf-8'));
		return Array.isArray(raw.numbers) ? raw.numbers : [];
	} catch {
		return [];
	}
}

export function writeWhitelist(numbers: string[]): void {
	ensureFile();
	writeFileSync(WHITELIST_FILE, JSON.stringify({ numbers }, null, 2));
}

export function isWhitelisted(phone: string): boolean {
	return readWhitelist().includes(phone);
}
