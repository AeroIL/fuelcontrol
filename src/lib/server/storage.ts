import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { SavedCard } from '$lib/types';
import type { Base } from './whitelist';

const DATA_DIR = join(process.cwd(), 'data');

function cardsFile(base: Base): string {
	return join(DATA_DIR, base === '2' ? 'cards2.json' : 'cards.json');
}

export function readCards(base: Base = '1'): SavedCard[] {
	const file = cardsFile(base);
	if (!existsSync(file)) return [];
	try {
		return JSON.parse(readFileSync(file, 'utf-8')) as SavedCard[];
	} catch {
		return [];
	}
}

export function writeCards(base: Base, cards: SavedCard[]): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
	writeFileSync(cardsFile(base), JSON.stringify(cards, null, 2), 'utf-8');
}
