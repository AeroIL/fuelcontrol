import { readData, writeData, type WhitelistEntry } from './data';
import { ADMIN_PHONE } from '$lib/server/auth';

export type { WhitelistEntry };
export type Base = string;

export function readWhitelist(base: Base = '1'): WhitelistEntry[] {
	return readData().whitelist[base] ?? [];
}

export function writeWhitelist(base: Base, entries: WhitelistEntry[]): void {
	const data = readData();
	data.whitelist[base] = entries;
	writeData(data);
}

/** Returns ALL bases a phone belongs to. Admin always returns []. */
export function getPhoneBases(phone: string): Base[] {
	if (phone === ADMIN_PHONE) return [];
	const data = readData();
	return data.bases
		.filter((b) => (data.whitelist[b.id] ?? []).some((e) => e.phone === phone))
		.map((b) => b.id);
}

/** Returns the first base a phone belongs to, or null (admin is never in a base). */
export function getPhoneBase(phone: string): Base | null {
	return getPhoneBases(phone)[0] ?? null;
}

/** Admin is always allowed; regular users must appear in at least one base whitelist. */
export function isWhitelisted(phone: string): boolean {
	if (phone === ADMIN_PHONE) return true;
	return getPhoneBases(phone).length > 0;
}

