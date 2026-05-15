import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { SavedCard } from '$lib/types';

const DATA_DIR = join(process.cwd(), 'data');
const DATA_FILE = join(DATA_DIR, 'cards.json');

export function readCards(): SavedCard[] {
	if (!existsSync(DATA_FILE)) return [];
	try {
		return JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as SavedCard[];
	} catch {
		return [];
	}
}

export function writeCards(cards: SavedCard[]): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
	writeFileSync(DATA_FILE, JSON.stringify(cards, null, 2), 'utf-8');
}
