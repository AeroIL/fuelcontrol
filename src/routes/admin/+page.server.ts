import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readWhitelist, writeWhitelist, type WhitelistEntry } from '$lib/server/whitelist';
import { normalizePhone } from '$lib/server/sms';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.phone !== ADMIN_PHONE) {
		throw redirect(302, '/');
	}
	return {
		entries1: readWhitelist('1'),
		entries2: readWhitelist('2')
	};
};

export const actions: Actions = {
	add1: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const name = String(data.get('name') ?? '').trim().slice(0, 60);
		if (!phone || phone.length < 9) {
			return fail(400, { error: 'מספר לא תקין', entries1: readWhitelist('1'), entries2: readWhitelist('2') });
		}
		if (phone === ADMIN_PHONE) {
			return fail(400, { error: 'מנהל המערכת אינו שייך לבסיס', entries1: readWhitelist('1'), entries2: readWhitelist('2') });
		}
		const list = readWhitelist('1');
		if (list.some((e: WhitelistEntry) => e.phone === phone)) {
			return fail(400, { error: 'המספר כבר ברשימה', entries1: list, entries2: readWhitelist('2') });
		}
		list.push({ phone, name });
		writeWhitelist('1', list);
		return { entries1: list, entries2: readWhitelist('2') };
	},

	remove1: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const list = readWhitelist('1').filter((e: WhitelistEntry) => e.phone !== phone);
		writeWhitelist('1', list);
		return { entries1: list, entries2: readWhitelist('2') };
	},

	add2: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const name = String(data.get('name') ?? '').trim().slice(0, 60);
		if (!phone || phone.length < 9) {
			return fail(400, { error: 'מספר לא תקין', entries1: readWhitelist('1'), entries2: readWhitelist('2') });
		}
		if (phone === ADMIN_PHONE) {
			return fail(400, { error: 'מנהל המערכת אינו שייך לבסיס', entries1: readWhitelist('1'), entries2: readWhitelist('2') });
		}
		const list2 = readWhitelist('2');
		if (list2.some((e: WhitelistEntry) => e.phone === phone)) {
			return fail(400, { error: 'המספר כבר ברשימה', entries1: readWhitelist('1'), entries2: list2 });
		}
		list2.push({ phone, name });
		writeWhitelist('2', list2);
		return { entries1: readWhitelist('1'), entries2: list2 };
	},

	remove2: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה' });
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const list2 = readWhitelist('2').filter((e: WhitelistEntry) => e.phone !== phone);
		writeWhitelist('2', list2);
		return { entries1: readWhitelist('1'), entries2: list2 };
	}
};

