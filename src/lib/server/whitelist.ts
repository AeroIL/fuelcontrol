import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ADMIN_PHONE } from '$lib/server/auth';

export type Base = '1' | '2';
export type WhitelistEntry = { phone: string; name: string };

const DATA_DIR = join(process.cwd(), 'data');

function whitelistFile(base: Base): string {
	return join(DATA_DIR, base === '2' ? 'whitelist2.json' : 'whitelist.json');
}

function ensureFile(base: Base): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
	const file = whitelistFile(base);
	if (!existsSync(file)) {
		// Admin is NOT a base member — start both bases empty
		writeFileSync(file, JSON.stringify({ entries: [] }, null, 2));
	}
}

export function readWhitelist(base: Base = '1'): WhitelistEntry[] {
	ensureFile(base);
	try {
		const raw = JSON.parse(readFileSync(whitelistFile(base), 'utf-8'));
		// New format: { entries: [{phone, name}] }
		if (Array.isArray(raw.entries)) {
			return (raw.entries as unknown[])
				.filter((e): e is { phone: string; name?: string } =>
					typeof e === 'object' && e !== null && typeof (e as { phone?: unknown }).phone === 'string'
				)
				.map((e) => ({ phone: e.phone, name: e.name ?? '' }));
		}
		// Legacy format: { numbers: string[] } — migrate transparently
		if (Array.isArray(raw.numbers)) {
			return (raw.numbers as string[])
				.filter((n) => n !== ADMIN_PHONE) // strip admin from legacy data
				.map((n) => ({ phone: n, name: '' }));
		}
		return [];
	} catch {
		return [];
	}
}

export function writeWhitelist(base: Base, entries: WhitelistEntry[]): void {
	ensureFile(base);
	writeFileSync(whitelistFile(base), JSON.stringify({ entries }, null, 2));
}

/** Returns which base a phone belongs to, or null (admin is never in a base). */
export function getPhoneBase(phone: string): Base | null {
	if (phone === ADMIN_PHONE) return null;
	if (readWhitelist('1').some((e) => e.phone === phone)) return '1';
	if (readWhitelist('2').some((e) => e.phone === phone)) return '2';
	return null;
}

/** Admin is always allowed; regular users must appear in a base whitelist. */
export function isWhitelisted(phone: string): boolean {
	if (phone === ADMIN_PHONE) return true;
	return getPhoneBase(phone) !== null;
}
