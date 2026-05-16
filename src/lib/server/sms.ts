/** Normalize Israeli phone to E.164 for textbee.dev */
export function toE164(phone: string): string {
	const digits = phone.replace(/\D/g, '');
	if (digits.startsWith('972')) return `+${digits}`;
	if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
	return `+972${digits}`;
}

/** Normalize user input to local format stored in whitelist (digits only, leading 0) */
export function normalizePhone(raw: string): string {
	const digits = raw.replace(/\D/g, '');
	if (digits.startsWith('972')) return `0${digits.slice(3)}`;
	return digits;
}

export async function sendOtp(phone: string, otp: string): Promise<void> {
	const apiKey = process.env.TEXTBEE_API_KEY;
	const deviceId = process.env.TEXTBEE_DEVICE_ID;
	if (!apiKey || !deviceId) throw new Error('TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID not set');

	const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey
		},
		body: JSON.stringify({
			recipients: [toE164(phone)],
			message: `קוד הגישה שלך הוא: ${otp}\nתקף ל-5 דקות בלבד.`
		})
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`SMS API error ${res.status}: ${text}`);
	}
}
