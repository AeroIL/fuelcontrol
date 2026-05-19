import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCards, writeCards } from '$lib/server/storage';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readData } from '$lib/server/data';

/**
 * Resolve which base to read/write for this request.
 * Re-reads data.json directly so the check is never stale — avoids any
 * cached-locals inconsistency for multi-base users.
 */
function resolveBase(locals: App.Locals, url: URL): string {
	const param = url.searchParams.get('base');
	const appData = readData(); // single read — reused for check and fallback
	if (param && locals.phone) {
		if (locals.phone === ADMIN_PHONE) {
			// Admin: any valid base
			if (appData.bases.some((b) => b.id === param)) return param;
		} else {
			// Regular user: only bases they belong to (re-read from DB, not cached locals)
			const userBases = appData.bases
				.filter((b) => (appData.whitelist[b.id] ?? []).some((e) => e.phone === locals.phone))
				.map((b) => b.id);
			if (userBases.includes(param)) return param;
		}
	}
	return locals.base ?? appData.bases[0]?.id ?? '1';
}


export const PATCH: RequestHandler = async ({ params, request, locals, url }) => {
	const base = resolveBase(locals, url);
	const { cardId } = params;
	const update = (await request.json()) as { holderName?: string };

	const cards = readCards(base);
	const idx = cards.findIndex((c) => c.id === cardId);
	if (idx < 0) throw error(404, 'Card not found');

	if (update.holderName !== undefined) {
		cards[idx].holderName = update.holderName.trim().slice(0, 100);
	}

	writeCards(base, cards);
	return json(cards[idx]);
};

export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	const base = resolveBase(locals, url);
	const { cardId } = params;
	const cards = readCards(base);
	writeCards(base, cards.filter((c) => c.id !== cardId));
	return json({ ok: true });
};
