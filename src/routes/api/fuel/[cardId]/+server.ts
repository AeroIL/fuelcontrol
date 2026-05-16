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
	// Send a 1-year date range so we get full transaction history
	const now = new Date();
	const oneYearAgo = new Date(now);
	oneYearAgo.setDate(now.getDate() - 7);
	const fmtDate = (d: Date) =>
		`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

	const formBody = new URLSearchParams({
		__VIEWSTATE: viewState,
		__VIEWSTATEGENERATOR: viewStateGenerator,
		__EVENTVALIDATION: eventValidation,
		'dpStart$dateInput': fmtDate(oneYearAgo),
		'dpEnd$dateInput': fmtDate(now),
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
	let cardName = '';
	let totalUsedLiters = 0;
	let usedLiters = 0;
	let remainingLiters = 0;
	let lastUsedDate = '';
	let isActive = false;

	// ── 0. Card name ("שם כרטיס") e.g. "סולר 50 ליטר" ──────────────────────
	const cardNameEl = $('[title*="שם כרטיס"]');
	if (cardNameEl.length) cardName = ct($, cardNameEl[0] as cheerio.Element);

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

		// Build a label→value map from consecutive cell pairs.
		// Row layout: [label][value][label][value]...
		// e.g. "סוג כרטיס:" → "קש דלק", "S/N:" → "949334247",
		//      "סכום שהשתמשו:" → "557.0000" (money, not liters!),
		//      "ליטרים שהשתמשו:" → "50.0000", "ליטרים שנותרו:" → "0.0000"
		for (let i = 0; i < vals.length - 1; i++) {
			const label = vals[i];
			const value = vals[i + 1];
			const num = parseFloat(value.replace(/,/g, ''));
			if (/סוג כרטיס/.test(label)) {
				cardType = value;
			} else if (/ליטרים שהשתמשו/.test(label)) {
				usedLiters = isNaN(num) ? 0 : num;
			} else if (/ליטרים שנותרו/.test(label)) {
				remainingLiters = isNaN(num) ? 0 : num;
			} else if (/סכום שהשתמשו|כמות שהשתמשו/.test(label)) {
				totalUsedLiters = isNaN(num) ? 0 : num;
			}
		}

		isActive = vals.some((v) => v === 'פעיל');
	});

	// ── 2. Last used date ────────────────────────────────────────────────────
	const bodyText = $('body').text();
	const afterLabel = bodyText.split('תאריך שימוש אחרון')[1] ?? '';
	const dateMatch = afterLabel.match(/(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/);
	if (dateMatch) lastUsedDate = dateMatch[1];

	// ── 3. Transaction table ─────────────────────────────────────────────────
	// Goodi uses Telerik RadGrid which splits the grid into three sibling tables:
	//   <id>_Header  — column header row
	//   <id>         — data rows
	//   <id>_Pager   — pagination
	// We find the _Header table by the "branch_number" / "station_name" fingerprint,
	// strip "_Header" to get the data table id, then read rows from there.
	const transactions: FuelTransaction[] = [];

	const buildColMap = (cells: cheerio.Cheerio<cheerio.Element>): Record<string, number> => {
		const colMap: Record<string, number> = {};
		cells.toArray().forEach((c, i) => {
			const t = ct($, c as cheerio.Element).toLowerCase();
			if (t.includes('branch_number')) colMap['branch'] = i;
			else if (t.includes('station_name')) colMap['station'] = i;
			else if (/תאריך/.test(t)) colMap['date'] = i;
			else if (/שעה/.test(t)) colMap['time'] = i;
			else if (/סיריאל|מטפר/.test(t)) colMap['serial'] = i;
			else if (/ליטר/.test(t)) colMap['liters'] = i;
			else if (/רכב/.test(t)) colMap['vehicle'] = i;
			else if (/חברת|דלק/.test(t)) colMap['fuelType'] = i;
			else if (/התקן|עסקה/.test(t)) colMap['txType'] = i;
		});
		return colMap;
	};

	$('table').each((_ti, hdrTable) => {
		const hdrId = $(hdrTable).attr('id') ?? '';
		// Must be the _Header table with branch_number in it
		if (!hdrId.endsWith('_Header')) return;
		const hdrText = $(hdrTable).html() ?? '';
		if (!hdrText.includes('branch_number') && !hdrText.includes('station_name')) return;

		// Build column map from the header row
		const hdrCells = $(hdrTable).find('tr').first().find('th, td');
		const colMap = buildColMap(hdrCells);
		if (Object.keys(colMap).length === 0) return;

		// The data table has the same id without "_Header"
		const dataTableId = hdrId.slice(0, -'_Header'.length);
		const dataTable = $(`#${CSS.escape(dataTableId)}`);
		if (!dataTable.length) return;

		dataTable.find('tr').each((_ri, row) => {
			const cells = $(row).find('td');
			if (cells.length < 3) return;

			const get = (key: string) => {
				const idx = colMap[key];
				return idx !== undefined ? ct($, cells[idx] as cheerio.Element) : '';
			};

			// Date arrives as "5/14/2026 12:00:00 AM" — strip the time suffix
			const dateVal = get('date').replace(/\s+\d+:\d+:\d+\s*(AM|PM)?$/i, '').trim();
			const litersRaw = get('liters').replace(/,/g, '');
			const liters = parseFloat(litersRaw) || 0;

			// Skip non-data rows (pager, calendar): need a real date or nonzero liters
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
		cardName,
		cardType: cardType || 'קש דלק',
		totalUsedLiters,
		usedLiters,
		remainingLiters,
		lastUsedDate,
		isActive,
		transactions
	};
}


