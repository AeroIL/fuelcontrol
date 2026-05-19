import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { SavedCard } from '$lib/types';

const DATA_DIR = join(process.cwd(), 'data');

function cardsPaths(base: string): { primary: string; legacy: string | null } {
	const primary = join(DATA_DIR, `cards-${base}.json`);
	let legacy: string | null = null;
	if (base === '1') legacy = join(DATA_DIR, 'cards.json');
	else if (base === '2') legacy = join(DATA_DIR, 'cards2.json');
	return { primary, legacy };
}

export function readCards(base: string = '1'): SavedCard[] {
	const { primary, legacy } = cardsPaths(base);
	for (const file of ([primary, legacy] as (string | null)[]).filter(Boolean) as string[]) {
		if (existsSync(file)) {
			try {
				return JSON.parse(readFileSync(file, 'utf-8')) as SavedCard[];
			} catch {
				/* try next */
			}
		}
	}
	return [];
}

export function writeCards(base: string, cards: SavedCard[]): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
	const { primary } = cardsPaths(base);
	writeFileSync(primary, JSON.stringify(cards, null, 2), 'utf-8');
}

/** Deletes the cards and whitelist data files for a base (called when deleting a base). */
export function deleteBaseData(base: string): void {
	const toDelete = [
		join(DATA_DIR, `cards-${base}.json`),
		join(DATA_DIR, `whitelist-${base}.json`)
	];
	for (const f of toDelete) {
		try {
			if (existsSync(f)) unlinkSync(f);
		} catch {
			/* ignore */
		}
	}
}
