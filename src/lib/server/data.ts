/**
 * Single-file data layer.
 * All app state lives in data/data.json:
 * {
 *   bases:     [{ id, name }, ...],
 *   whitelist: { "<baseId>": [{ phone, name }, ...], ... },
 *   cards:     { "<baseId>": [SavedCard, ...], ... }
 * }
 *
 * On first boot (or if data.json is missing) we migrate from the old
 * per-base files automatically so no data is lost.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { SavedCard } from '$lib/types';

export type BaseConfig = { id: string; name: string };
export type WhitelistEntry = { phone: string; name: string };

export type AppData = {
	bases: BaseConfig[];
	whitelist: Record<string, WhitelistEntry[]>;
	cards: Record<string, SavedCard[]>;
};

const DATA_DIR = join(process.cwd(), 'data');
const DATA_FILE = join(DATA_DIR, 'data.json');

const DEFAULT_BASES: BaseConfig[] = [
	{ id: '1', name: 'בסיס 1' },
	{ id: '2', name: 'בסיס 2' }
];

function ensureDir(): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

/** Parse whitelist entries from the old per-base file format. */
function parseLegacyWhitelist(raw: unknown): WhitelistEntry[] {
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
	// Legacy format: { numbers: string[] }
	if (Array.isArray(r.numbers)) {
		return (r.numbers as string[]).map((n) => ({ phone: n, name: '' }));
	}
	return [];
}

/**
 * One-time migration: read old per-base files → build and save data.json.
 * Called only when data.json does not yet exist.
 */
function migrateFromLegacy(): AppData {
	ensureDir();

	// Read bases list (new-style bases.json if available)
	let bases: BaseConfig[] = DEFAULT_BASES;
	const basesFile = join(DATA_DIR, 'bases.json');
	if (existsSync(basesFile)) {
		try {
			const raw = JSON.parse(readFileSync(basesFile, 'utf-8'));
			if (Array.isArray(raw.bases) && raw.bases.length > 0) {
				bases = raw.bases as BaseConfig[];
			}
		} catch {
			/* use defaults */
		}
	}

	const whitelist: Record<string, WhitelistEntry[]> = {};
	const cards: Record<string, SavedCard[]> = {};

	for (const base of bases) {
		// Whitelist: new-style name first, then legacy names for base '1' and '2'
		const wPaths = [
			join(DATA_DIR, `whitelist-${base.id}.json`),
			...(base.id === '1' ? [join(DATA_DIR, 'whitelist.json')] : []),
			...(base.id === '2' ? [join(DATA_DIR, 'whitelist2.json')] : [])
		];
		whitelist[base.id] = [];
		for (const f of wPaths) {
			if (existsSync(f)) {
				try {
					whitelist[base.id] = parseLegacyWhitelist(JSON.parse(readFileSync(f, 'utf-8')));
					break;
				} catch {
					/* try next */
				}
			}
		}

		// Cards: new-style name first, then legacy names
		const cPaths = [
			join(DATA_DIR, `cards-${base.id}.json`),
			...(base.id === '1' ? [join(DATA_DIR, 'cards.json')] : []),
			...(base.id === '2' ? [join(DATA_DIR, 'cards2.json')] : [])
		];
		cards[base.id] = [];
		for (const f of cPaths) {
			if (existsSync(f)) {
				try {
					cards[base.id] = JSON.parse(readFileSync(f, 'utf-8')) as SavedCard[];
					break;
				} catch {
					/* try next */
				}
			}
		}
	}

	const data: AppData = { bases, whitelist, cards };
	writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
	return data;
}

/** Read the entire app data from data.json (migrating from legacy on first run). */
export function readData(): AppData {
	ensureDir();
	if (!existsSync(DATA_FILE)) {
		return migrateFromLegacy();
	}
	try {
		const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as AppData;
		if (!Array.isArray(parsed.bases)) throw new Error('invalid structure');
		return parsed;
	} catch {
		return migrateFromLegacy();
	}
}

/** Atomically write all app data to data.json. */
export function writeData(data: AppData): void {
	ensureDir();
	writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
