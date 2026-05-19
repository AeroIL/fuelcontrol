import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCards, writeCards } from '$lib/server/storage';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readData } from '$lib/server/data';
import type { SavedCard } from '$lib/types';

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


export const GET: RequestHandler = async ({ locals, url }) => {
        return json(readCards(resolveBase(locals, url)));
};

export const POST: RequestHandler = async ({ request, locals, url }) => {
        const base = resolveBase(locals, url);
        const incoming = (await request.json()) as SavedCard;

        if (!incoming.id || !/^\d{5,15}$/.test(incoming.id)) {
                throw error(400, 'Invalid card ID');
        }

        const cards = readCards(base);
        const idx = cards.findIndex((c) => c.id === incoming.id);

        if (idx >= 0) {
                // Update data but preserve existing holder name
                cards[idx] = {
                        ...cards[idx],
                        data: incoming.data,
                        lastFetched: incoming.lastFetched
                };
        } else {
                cards.unshift(incoming);
        }

        writeCards(base, cards);
        return json(cards);
};
