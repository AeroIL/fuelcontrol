import { createHmac, randomInt } from 'crypto';

export const COOKIE_NAME = 'fuel_session';
export const ADMIN_PHONE = '0524746673';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const OTP_TTL_MS = 5 * 60 * 1000; // 5 min

// In-memory OTP store — one instance per process, fine for Railway single-container
const otpStore = new Map<string, { otp: string; expires: number }>();

export function generateOtp(): string {
	return String(randomInt(100000, 999999));
}

export function storeOtp(phone: string, otp: string): void {
	otpStore.set(phone, { otp, expires: Date.now() + OTP_TTL_MS });
}

export function verifyOtp(phone: string, otp: string): boolean {
	const entry = otpStore.get(phone);
	if (!entry) return false;
	if (Date.now() > entry.expires) {
		otpStore.delete(phone);
		return false;
	}
	if (entry.otp !== otp) return false;
	otpStore.delete(phone); // one-time use
	return true;
}

function getSecret(): string {
	const s = process.env.SESSION_SECRET;
	if (!s) throw new Error('SESSION_SECRET env var is not set');
	return s;
}

function sign(payload: string): string {
	return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

export function createSession(phone: string): string {
	const expires = Date.now() + SESSION_DURATION_MS;
	const payload = JSON.stringify({ phone, expires });
	const encoded = Buffer.from(payload).toString('base64url');
	const sig = sign(encoded);
	return `${encoded}.${sig}`;
}

export function parseSession(token: string): string | null {
	try {
		const dot = token.lastIndexOf('.');
		if (dot === -1) return null;
		const encoded = token.slice(0, dot);
		const sig = token.slice(dot + 1);
		if (sign(encoded) !== sig) return null;
		const { phone, expires } = JSON.parse(Buffer.from(encoded, 'base64url').toString());
		if (Date.now() > expires) return null;
		return typeof phone === 'string' ? phone : null;
	} catch {
		return null;
	}
}
