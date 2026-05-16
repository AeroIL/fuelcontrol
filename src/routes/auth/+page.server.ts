import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { generateOtp, storeOtp, verifyOtp, createSession, COOKIE_NAME } from '$lib/server/auth';
import { isWhitelisted } from '$lib/server/whitelist';
import { sendOtp } from '$lib/server/sms';
import { normalizePhone } from '$lib/server/sms';

export const load: PageServerLoad = async ({ cookies }) => {
	// Already has a valid session? Redirect home
	const { parseSession } = await import('$lib/server/auth');
	const token = cookies.get(COOKIE_NAME) ?? '';
	if (token && parseSession(token)) {
		throw redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	sendOtp: async ({ request }) => {
		const data = await request.formData();
		const raw = String(data.get('phone') ?? '').trim();
		const phone = normalizePhone(raw);

		if (!phone || phone.length < 9) {
			return fail(400, { error: 'מספר טלפון לא תקין', step: 'phone' });
		}
		if (!isWhitelisted(phone)) {
			return fail(403, { error: 'מספר זה אינו מורשה גישה', step: 'phone' });
		}

		const otp = generateOtp();
		storeOtp(phone, otp);
		try {
			await sendOtp(phone, otp);
		} catch (err) {
			console.error('SMS send failed:', err);
			return fail(500, { error: 'שגיאה בשליחת SMS — נסה שוב', step: 'phone' });
		}

		return { step: 'otp', phone };
	},

	verifyOtp: async ({ request, cookies }) => {
		const data = await request.formData();
		const phone = normalizePhone(String(data.get('phone') ?? '').trim());
		const otp = String(data.get('otp') ?? '').trim();

		if (!verifyOtp(phone, otp)) {
			return fail(401, { error: 'קוד שגוי או פג תוקף', step: 'otp', phone });
		}

		const token = createSession(phone);
		cookies.set(COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 24 * 60 * 60
		});
		throw redirect(302, '/');
	}
};
