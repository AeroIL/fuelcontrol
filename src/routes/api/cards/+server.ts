import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readCards, writeCards } from '$lib/server/storage';
import type { SavedCard } from '$lib/types';

export const GET: RequestHandler = async () => {
	return json(readCards());
};

export const POST: RequestHandler = async ({ request }) => {
	const incoming = (await request.json()) as SavedCard;

	if (!incoming.id || !/^\d{5,15}$/.test(incoming.id)) {
		throw error(400, 'Invalid card ID');
	}

	const cards = readCards();
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

	writeCards(cards);
	return json(cards);
};
