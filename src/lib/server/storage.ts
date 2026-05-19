import { readData, writeData } from './data';
import type { SavedCard } from '$lib/types';

export function readCards(base: string = '1'): SavedCard[] {
	return readData().cards[base] ?? [];
}

export function writeCards(base: string, cards: SavedCard[]): void {
	const data = readData();
	data.cards[base] = cards;
	writeData(data);
}

/**
 * No-op: removeBase() in bases.ts already deletes cards and whitelist
 * atomically inside data.json. Kept for backward compatibility.
 */
export function deleteBaseData(_base: string): void {
	// handled by removeBase()
}

