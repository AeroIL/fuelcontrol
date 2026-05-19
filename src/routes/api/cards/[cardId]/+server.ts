import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCards, writeCards } from '$lib/server/storage';
import { ADMIN_PHONE } from '$lib/server/auth';
import type { Base } from '$lib/server/whitelist';

function resolveBase(locals: App.Locals, url: URL): Base {
	const param = url.searchParams.get('base');
	if (locals.phone === ADMIN_PHONE && (param === '1' || param === '2')) return param;
	return locals.base ?? '1';
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
