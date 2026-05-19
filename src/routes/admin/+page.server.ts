import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readWhitelist, writeWhitelist } from '$lib/server/whitelist';
import { normalizePhone } from '$lib/server/sms';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.phone !== ADMIN_PHONE) {
		throw redirect(302, '/');
	}
	return {
		numbers1: readWhitelist('1'),
		numbers2: readWhitelist('2')
	};
};

export const actions: Actions = {
	add1: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		if (!phone || phone.length < 9) {
			return fail(400, { error: 'מספר לא תקין', numbers1: readWhitelist('1'), numbers2: readWhitelist('2') });
		}
		const list = readWhitelist('1');
		if (list.includes(phone)) {
			return fail(400, { error: 'המספר כבר ברשימה', numbers1: list, numbers2: readWhitelist('2') });
		}
		list.push(phone);
		writeWhitelist('1', list);
		return { numbers1: list, numbers2: readWhitelist('2') };
	},

	remove1: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		if (phone === ADMIN_PHONE) {
			return fail(400, { error: 'לא ניתן להסיר את מנהל המערכת', numbers1: readWhitelist('1'), numbers2: readWhitelist('2') });
		}
		const list = readWhitelist('1').filter((n) => n !== phone);
		writeWhitelist('1', list);
		return { numbers1: list, numbers2: readWhitelist('2') };
	},

	add2: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		if (!phone || phone.length < 9) {
			return fail(400, { error: 'מספר לא תקין', numbers1: readWhitelist('1'), numbers2: readWhitelist('2') });
		}
		const list2 = readWhitelist('2');
		if (list2.includes(phone)) {
			return fail(400, { error: 'המספר כבר ברשימה', numbers1: readWhitelist('1'), numbers2: list2 });
		}
		list2.push(phone);
		writeWhitelist('2', list2);
		return { numbers1: readWhitelist('1'), numbers2: list2 };
	},

	remove2: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const list2 = readWhitelist('2').filter((n) => n !== phone);
		writeWhitelist('2', list2);
		return { numbers1: readWhitelist('1'), numbers2: list2 };
	}
};
