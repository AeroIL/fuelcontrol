import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCards, writeCards } from '$lib/server/storage';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readBases } from '$lib/server/bases';
import type { SavedCard } from '$lib/types';

function resolveBase(locals: App.Locals, url: URL): string {
	const param = url.searchParams.get('base');
	if (locals.phone === ADMIN_PHONE && param) {
		if (readBases().some((b) => b.id === param)) return param;
	}
	return locals.base ?? readBases()[0]?.id ?? '1';
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
