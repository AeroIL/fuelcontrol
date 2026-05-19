import { readData, writeData, type BaseConfig } from './data';

export type { BaseConfig };

export function readBases(): BaseConfig[] {
	return readData().bases;
}

export function writeBases(bases: BaseConfig[]): void {
	const data = readData();
	data.bases = bases;
	writeData(data);
}

/** Adds a new base with a unique auto-generated numeric ID. Returns the new config. */
export function addBase(name: string): BaseConfig {
	const data = readData();
	const numericIds = data.bases.map((b) => parseInt(b.id, 10)).filter((n) => !isNaN(n));
	const nextId = numericIds.length > 0 ? String(Math.max(...numericIds) + 1) : '1';
	const newBase: BaseConfig = { id: nextId, name: name.trim() };
	data.bases.push(newBase);
	data.whitelist[nextId] = [];
	data.cards[nextId] = [];
	writeData(data);
	return newBase;
}

/** Removes a base by ID and deletes its whitelist and cards in one write. */
export function removeBase(id: string): BaseConfig | null {
	const data = readData();
	const idx = data.bases.findIndex((b) => b.id === id);
	if (idx < 0) return null;
	const [removed] = data.bases.splice(idx, 1);
	delete data.whitelist[id];
	delete data.cards[id];
	writeData(data);
	return removed;
}

