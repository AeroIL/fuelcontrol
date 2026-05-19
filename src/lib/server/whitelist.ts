import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readBases } from '$lib/server/bases';

export type Base = string;
export type WhitelistEntry = { phone: string; name: string };

const DATA_DIR = join(process.cwd(), 'data');

/** Returns primary (new-style) and legacy paths for a base's whitelist file. */
function whitelistPaths(base: Base): { primary: string; legacy: string | null } {
	const primary = join(DATA_DIR, `whitelist-${base}.json`);
	let legacy: string | null = null;
	if (base === '1') legacy = join(DATA_DIR, 'whitelist.json');
	else if (base === '2') legacy = join(DATA_DIR, 'whitelist2.json');
	return { primary, legacy };
}

function ensureDir(): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function parseEntries(raw: unknown): WhitelistEntry[] {
	if (typeof raw !== 'object' || raw === null) return [];
	const r = raw as Record<string, unknown>;
	// New format: { entries: [{phone, name}] }
	if (Array.isArray(r.entries)) {
		return (r.entries as unknown[])
			.filter(
				(e): e is { phone: string; name?: string } =>
					typeof e === 'object' && e !== null && typeof (e as { phone?: unknown }).phone === 'string'
			)
			.map((e) => ({ phone: e.phone, name: e.name ?? '' }));
	}
	// Legacy format: { numbers: string[] } — migrate transparently
	if (Array.isArray(r.numbers)) {
		return (r.numbers as string[])
			.filter((n) => n !== ADMIN_PHONE)
			.map((n) => ({ phone: n, name: '' }));
	}
	return [];
}

export function readWhitelist(base: Base = '1'): WhitelistEntry[] {
	ensureDir();
	const { primary, legacy } = whitelistPaths(base);
	for (const file of ([primary, legacy] as (string | null)[]).filter(Boolean) as string[]) {
		if (existsSync(file)) {
			try {
				return parseEntries(JSON.parse(readFileSync(file, 'utf-8')));
			} catch {
				/* try next */
			}
		}
	}
	return [];
}

export function writeWhitelist(base: Base, entries: WhitelistEntry[]): void {
	ensureDir();
	const { primary } = whitelistPaths(base);
	writeFileSync(primary, JSON.stringify({ entries }, null, 2));
}

/** Returns which base a phone belongs to, or null (admin is never in a base). */
export function getPhoneBase(phone: string): Base | null {
	if (phone === ADMIN_PHONE) return null;
	const bases = readBases();
	for (const b of bases) {
		if (readWhitelist(b.id).some((e) => e.phone === phone)) return b.id;
	}
	return null;
}

/** Admin is always allowed; regular users must appear in a base whitelist. */
export function isWhitelisted(phone: string): boolean {
	if (phone === ADMIN_PHONE) return true;
	return getPhoneBase(phone) !== null;
}
