import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type BaseConfig = { id: string; name: string };

const DATA_DIR = join(process.cwd(), 'data');
const BASES_FILE = join(DATA_DIR, 'bases.json');

const DEFAULT_BASES: BaseConfig[] = [
	{ id: '1', name: 'בסיס 1' },
	{ id: '2', name: 'בסיס 2' }
];

function ensureDir(): void {
	if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function readBases(): BaseConfig[] {
	ensureDir();
	if (!existsSync(BASES_FILE)) {
		writeFileSync(BASES_FILE, JSON.stringify({ bases: DEFAULT_BASES }, null, 2));
		return DEFAULT_BASES;
	}
	try {
		const raw = JSON.parse(readFileSync(BASES_FILE, 'utf-8'));
		if (Array.isArray(raw.bases) && raw.bases.length > 0) {
			return (raw.bases as unknown[]).filter(
				(b): b is BaseConfig =>
					typeof b === 'object' &&
					b !== null &&
					typeof (b as BaseConfig).id === 'string' &&
					typeof (b as BaseConfig).name === 'string'
			);
		}
	} catch {
		/* fallback to defaults */
	}
	return DEFAULT_BASES;
}

export function writeBases(bases: BaseConfig[]): void {
	ensureDir();
	writeFileSync(BASES_FILE, JSON.stringify({ bases }, null, 2));
}

/** Adds a new base with a unique auto-generated numeric ID. Returns the new config. */
export function addBase(name: string): BaseConfig {
	const bases = readBases();
	const numericIds = bases.map((b) => parseInt(b.id, 10)).filter((n) => !isNaN(n));
	const nextId = numericIds.length > 0 ? String(Math.max(...numericIds) + 1) : '1';
	const newBase: BaseConfig = { id: nextId, name: name.trim() };
	bases.push(newBase);
	writeBases(bases);
	return newBase;
}

/** Removes a base by ID from the list. Returns the removed config or null if not found. */
export function removeBase(id: string): BaseConfig | null {
	const bases = readBases();
	const idx = bases.findIndex((b) => b.id === id);
	if (idx < 0) return null;
	const [removed] = bases.splice(idx, 1);
	writeBases(bases);
	return removed;
}
