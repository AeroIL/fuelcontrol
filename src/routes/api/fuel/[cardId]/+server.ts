import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as cheerio from 'cheerio';
import type { FuelCard, FuelTransaction } from '$lib/types';

const BASE_URL = 'https://fueladmin.goodi.co.il/_fuel/';

const COMMON_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
	Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
	'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
};

export const GET: RequestHandler = async ({ params }) => {
	const { cardId } = params;

	if (!cardId || !/^\d{5,15}$/.test(cardId)) {
		throw error(400, 'מספר כרטיס לא תקין');
	}

	// Step 1: GET the page to extract ASP.NET form state tokens
	let initHtml: string;
	let sessionCookie: string;

	try {
		const initRes = await fetch(BASE_URL, { headers: COMMON_HEADERS });
		if (!initRes.ok) throw new Error(`HTTP ${initRes.status}`);
		initHtml = await initRes.text();
		sessionCookie = initRes.headers.get('set-cookie') ?? '';
	} catch (e) {
		console.error('[fuel] Init fetch failed:', e);
		throw error(502, 'לא ניתן להתחבר לשרת Goodi');
	}

	const $init = cheerio.load(initHtml);
	const viewState = String($init('#__VIEWSTATE').val() ?? '');
	const viewStateGenerator = String($init('#__VIEWSTATEGENERATOR').val() ?? '');
	const eventValidation = String($init('#__EVENTVALIDATION').val() ?? '');

	// Step 2: POST the search form with card ID
	const formBody = new URLSearchParams({
		__VIEWSTATE: viewState,
		__VIEWSTATEGENERATOR: viewStateGenerator,
		__EVENTVALIDATION: eventValidation,
		tbSearch: cardId,
		btnSearch: 'חפש'
	});

	let resultHtml: string;
	try {
		const searchRes = await fetch(BASE_URL, {
			method: 'POST',
			headers: {
				...COMMON_HEADERS,
				'Content-Type': 'application/x-www-form-urlencoded',
				Referer: BASE_URL,
				Origin: 'https://fueladmin.goodi.co.il',
				Cookie: sessionCookie
			},
			body: formBody.toString()
		});
		if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);
		resultHtml = await searchRes.text();
	} catch (e) {
		console.error('[fuel] Search POST failed:', e);
		throw error(502, 'שגיאה בחיפוש הכרטיס');
	}

	const data = parseHtml(resultHtml, cardId);
	return json(data);
};

/** Get clean single-line text from an element */
function ct($: cheerio.CheerioAPI, el: cheerio.Element): string {
	return $(el).text().replace(/\s+/g, ' ').trim();
}

function parseHtml(html: string, cardId: string): FuelCard {
	const $ = cheerio.load(html);

	let cardType = 'קש דלק';
	let totalUsedLiters = 0;
	let usedLiters = 0;
	let remainingLiters = 0;
	let lastUsedDate = '';
	let isActive = false;

	// ── 1. Summary row ──────────────────────────────────────────────────────
	// Find the row where ONE cell's text is EXACTLY the cardId (the S/N cell).
	$('tr').each((_i, row) => {
		const cells = $(row).find('td');
		if (cells.length < 3) return;

		let hasSerial = false;
		cells.each((_j, cell) => {
			if (ct($, cell) === cardId) hasSerial = true;
		});
		if (!hasSerial) return;

		const vals = cells.toArray().map((c) => ct($, c as cheerio.Element));

		// First short Hebrew-text cell → card type
		for (const v of vals) {
			if (/[\u0590-\u05FF]/.test(v) && !/(פעיל|לא פעיל)/.test(v) && v.length < 30) {
				cardType = v;
				break;
			}
		}

		// Cells that look like decimal liters (e.g. "37.4130", "311.2800")
		const decimals = vals
			.filter((v) => v !== cardId && /^\d+\.\d+$/.test(v.replace(/,/g, '')))
			.map((v) => parseFloat(v.replace(/,/g, '')))
			.filter((n) => !isNaN(n))
			.sort((a, b) => b - a);

		if (decimals.length >= 3) {
			totalUsedLiters = decimals[0];
			usedLiters = decimals[1];
			remainingLiters = decimals[2];
		} else if (decimals.length === 2) {
			usedLiters = decimals[0];
			remainingLiters = decimals[1];
		} else if (decimals.length === 1) {
			usedLiters = decimals[0];
		}

		isActive = vals.some((v) => v === 'פעיל');
	});

	// ── 2. Last used date ────────────────────────────────────────────────────
	const bodyText = $('body').text();
	const afterLabel = bodyText.split('תאריך שימוש אחרון')[1] ?? '';
	const dateMatch = afterLabel.match(/(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/);
	if (dateMatch) lastUsedDate = dateMatch[1];

	// ── 3. Transaction table ─────────────────────────────────────────────────
	// Unique fingerprint: the header row contains the English text "branch_number"
	// and/or "station_name" — these are Goodi's own column identifiers.
	const transactions: FuelTransaction[] = [];

	$('table').each((_ti, table) => {
		const rows = $(table).find('tr');
		if (rows.length < 2) return;

		let hdrIdx = -1;
		const colMap: Record<string, number> = {};

		rows.each((ri, row) => {
			if (hdrIdx >= 0) return;
			const cells = $(row).find('th, td');
			const texts = cells.toArray().map((c) => ct($, c as cheerio.Element).toLowerCase());
			const joined = texts.join('§');

			if (!joined.includes('branch_number') && !joined.includes('station_name')) return;

			hdrIdx = ri;
			texts.forEach((t, i) => {
				if (t.includes('branch_number')) colMap['branch'] = i;
				else if (t.includes('station_name')) colMap['station'] = i;
				else if (/תאריך/.test(t)) colMap['date'] = i;
				else if (/שעה/.test(t)) colMap['time'] = i;
				else if (/סיריאל|מטפר/.test(t)) colMap['serial'] = i;
				else if (/ליטר|כ.ליטר/.test(t)) colMap['liters'] = i;
				else if (/רכב/.test(t)) colMap['vehicle'] = i;
				else if (/חגרת|חברת|דלק/.test(t)) colMap['fuelType'] = i;
				else if (/סוג.ה|התקן|עסקה/.test(t)) colMap['txType'] = i;
			});
		});

		if (hdrIdx < 0) return;

		rows.each((ri, row) => {
			if (ri <= hdrIdx) return;
			const cells = $(row).find('td');
			if (cells.length < 3) return;

			const get = (key: string) => {
				const idx = colMap[key];
				return idx !== undefined ? ct($, cells[idx] as cheerio.Element) : '';
			};

			const dateVal = get('date');
			const litersRaw = get('liters').replace(/,/g, '');
			const liters = parseFloat(litersRaw) || 0;

			// Skip pager / calendar rows: must have a real date
			if (!/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(dateVal) && liters === 0) return;

			transactions.push({
				vehicleNumber: get('vehicle'),
				fuelType: get('fuelType'),
				transactionType: get('txType'),
				date: dateVal,
				time: get('time'),
				stationName: get('station'),
				branchNumber: get('branch'),
				serialNumber: get('serial') || cardId,
				litersOrCost: liters
			});
		});
	});

	return {
		serial: cardId,
		cardType: cardType || 'קש דלק',
		totalUsedLiters,
		usedLiters,
		remainingLiters,
		lastUsedDate,
		isActive,
		transactions
	};
}


