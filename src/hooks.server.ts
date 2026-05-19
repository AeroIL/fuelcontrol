import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { parseSession, COOKIE_NAME } from '$lib/server/auth';
import { getPhoneBase, getPhoneBases } from '$lib/server/whitelist';

// Paths that don't require authentication
const PUBLIC_PREFIXES = ['/auth', '/api/auth/'];

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	const isPublic = PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
	if (isPublic) {
		event.locals.phone = null;
		event.locals.base = null;
		event.locals.userBases = [];
		return resolve(event);
	}

	const token = event.cookies.get(COOKIE_NAME) ?? '';
	const phone = token ? parseSession(token) : null;

	if (!phone) {
		throw redirect(302, '/auth');
	}

	event.locals.phone = phone;
	const userBases = getPhoneBases(phone);
	event.locals.userBases = userBases;
	event.locals.base = userBases[0] ?? null; // null for admin (no fixed base)
	return resolve(event);
};
