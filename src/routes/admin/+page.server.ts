import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ADMIN_PHONE } from '$lib/server/auth';
import { readWhitelist, writeWhitelist, type WhitelistEntry } from '$lib/server/whitelist';
import { readBases, addBase, removeBase, type BaseConfig } from '$lib/server/bases';
import { deleteBaseData } from '$lib/server/storage';
import { normalizePhone } from '$lib/server/sms';

function loadAll(): { bases: BaseConfig[]; entries: Record<string, WhitelistEntry[]> } {
	const bases = readBases();
	const entries: Record<string, WhitelistEntry[]> = {};
	for (const b of bases) entries[b.id] = readWhitelist(b.id);
	return { bases, entries };
}

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.phone !== ADMIN_PHONE) throw redirect(302, '/');
	return loadAll();
};

export const actions: Actions = {
	createBase: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה', ...loadAll() });
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim().slice(0, 60);
		if (!name) return fail(400, { error: 'שם הבסיס לא יכול להיות ריק', ...loadAll() });
		addBase(name);
		return loadAll();
	},

	deleteBase: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה', ...loadAll() });
		const data = await request.formData();
		const id = String(data.get('id') ?? '').trim();
		if (!id) return fail(400, { error: 'מזהה בסיס חסר', ...loadAll() });
		removeBase(id);
		deleteBaseData(id);
		return loadAll();
	},

	addMember: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה', ...loadAll() });
		const data = await request.formData();
		const baseId = String(data.get('baseId') ?? '').trim();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const name = String(data.get('name') ?? '').trim().slice(0, 60);
		const bases = readBases();
		if (!bases.some((b) => b.id === baseId))
			return fail(400, { error: 'בסיס לא קיים', ...loadAll() });
		if (!phone || phone.length < 9)
			return fail(400, { error: 'מספר לא תקין', ...loadAll() });
		if (phone === ADMIN_PHONE)
			return fail(400, { error: 'מנהל המערכת אינו שייך לבסיס', ...loadAll() });
		const list = readWhitelist(baseId);
		if (list.some((e) => e.phone === phone))
			return fail(400, { error: 'המספר כבר ברשימה', ...loadAll() });
		list.push({ phone, name });
		writeWhitelist(baseId, list);
		return loadAll();
	},

	removeMember: async ({ request, locals }) => {
		if (locals.phone !== ADMIN_PHONE) return fail(403, { error: 'אין הרשאה', ...loadAll() });
		const data = await request.formData();
		const baseId = String(data.get('baseId') ?? '').trim();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const list = readWhitelist(baseId).filter((e) => e.phone !== phone);
		writeWhitelist(baseId, list);
		return loadAll();
	}
};

