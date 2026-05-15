import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCards, writeCards } from '$lib/server/storage';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { cardId } = params;
	const update = (await request.json()) as { holderName?: string };

	const cards = readCards();
	const idx = cards.findIndex((c) => c.id === cardId);
	if (idx < 0) throw error(404, 'Card not found');

	if (update.holderName !== undefined) {
		cards[idx].holderName = update.holderName.trim().slice(0, 100);
	}

	writeCards(cards);
	return json(cards[idx]);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { cardId } = params;
	const cards = readCards();
	writeCards(cards.filter((c) => c.id !== cardId));
	return json({ ok: true });
};
