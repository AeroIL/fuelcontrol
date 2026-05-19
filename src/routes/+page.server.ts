import type { PageServerLoad } from './$types';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readBases } from '$lib/server/bases';

export const load: PageServerLoad = async ({ locals }) => {
	const bases = readBases();
	return {
		phone: locals.phone,
		isAdmin: locals.phone === ADMIN_PHONE,
		base: locals.base ?? bases[0]?.id ?? '1',
		bases
	};
};
