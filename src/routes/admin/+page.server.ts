import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readWhitelist, writeWhitelist } from '$lib/server/whitelist';
import { normalizePhone } from '$lib/server/sms';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.phone !== ADMIN_PHONE) {
		throw redirect(302, '/');
	}
	return { numbers: readWhitelist() };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		if (!phone || phone.length < 9) {
			return fail(400, { error: 'מספר לא תקין', numbers: readWhitelist() });
		}
		const list = readWhitelist();
		if (list.includes(phone)) {
			return fail(400, { error: 'המספר כבר ברשימה', numbers: list });
		}
		list.push(phone);
		writeWhitelist(list);
		return { numbers: list };
	},

	remove: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		if (phone === ADMIN_PHONE) {
			return fail(400, { error: 'לא ניתן להסיר את מנהל המערכת', numbers: readWhitelist() });
		}
		const list = readWhitelist().filter((n) => n !== phone);
		writeWhitelist(list);
		return { numbers: list };
	}
};
