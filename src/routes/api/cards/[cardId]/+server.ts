import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCards, writeCards } from '$lib/server/storage';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const base = locals.base ?? '1';
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

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const base = locals.base ?? '1';
	const { cardId } = params;
	const cards = readCards(base);
	writeCards(base, cards.filter((c) => c.id !== cardId));
	return json({ ok: true });
};
