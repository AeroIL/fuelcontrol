import type { PageServerLoad } from './$types';
import { ADMIN_PHONE } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		phone: locals.phone,
		isAdmin: locals.phone === ADMIN_PHONE,
		base: locals.base ?? '1'
	};
};
