<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import CardItem from '$lib/components/CardItem.svelte';
	import type { SavedCard } from '$lib/types';
	import type { PageData } from './$types';

	export let data: PageData;
	$: phone = data.phone;
	$: isAdmin = data.isAdmin;

	// Admin can switch which base they're viewing
	let viewBase: '1' | '2' = (data.base as '1' | '2') ?? '1';
	$: baseParam = isAdmin ? `?base=${viewBase}` : '';

	function switchBase(b: '1' | '2') {
		if (viewBase === b) return;
		viewBase = b;
		cards = [];
		loadCards();
	}

	let cards: SavedCard[] = [];
	let refreshingIds = new Set<string>();
	let addInput = '';
	let adding = false;
	let addError = '';
	let cardSearch = '';
	let toast = '';
	let toastTimer: ReturnType<typeof setTimeout>;

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.href = '/auth';
	}

	// Filters
	type FuelFilter = 'all' | 'diesel' | 'gasoline';
	type FillFilter = 'all' | 'full' | 'partial' | 'empty';
	let fuelFilter: FuelFilter = 'all';
	let fillFilter: FillFilter = 'all';

	$: filteredCards = cards.filter((c) => {
		const name = (c.data?.cardName ?? '').toLowerCase();
		if (fuelFilter === 'diesel' && !/סולר|diesel/i.test(name)) return false;
		if (fuelFilter === 'gasoline' && !/בנזין|gasoline|95/i.test(name)) return false;
		const rem = Number(c.data?.remainingLiters ?? 0);
		if (fillFilter === 'full' && rem <= 50) return false;
		if (fillFilter === 'partial' && (rem < 1 || rem >= 50)) return false;
		if (fillFilter === 'empty' && rem >= 1) return false;
		return true;
	});

	$: displayedCards = (() => {
		const q = cardSearch.trim().toLowerCase();
		if (!q) return filteredCards;
		return filteredCards.filter((c) =>
			c.id.includes(q) ||
			(c.holderName ?? '').toLowerCase().includes(q) ||
			(c.data?.cardName ?? '').toLowerCase().includes(q)
		);
	})();

	onMount(async () => {
		await loadCards();
	});

	async function loadCards() {
		try {
			const res = await fetch(`/api/cards${baseParam}`);
			if (res.ok) {
				cards = await res.json();
				// Background-refresh all saved cards silently
				if (cards.length > 0) refreshAll();
			}
		} catch {
			// ignore
		}
	}

	async function refreshCard(cardId: string) {
		refreshingIds = new Set([...refreshingIds, cardId]);
		try {
			const fuelRes = await fetch(`/api/fuel/${encodeURIComponent(cardId)}`);
			if (!fuelRes.ok) return;
			const fuelData = await fuelRes.json();

			const payload: SavedCard = {
				id: cardId,
				holderName: cards.find((c) => c.id === cardId)?.holderName ?? '',
				lastFetched: new Date().toISOString(),
				data: fuelData
			};

			const saveRes = await fetch(`/api/cards${baseParam}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (saveRes.ok) cards = await saveRes.json();
		} catch {
			// silent fail
		} finally {
			refreshingIds = new Set([...refreshingIds].filter((id) => id !== cardId));
		}
	}

	function refreshAll() {
		for (const c of cards) refreshCard(c.id);
	}

	async function addCard() {
		const id = addInput.trim().replace(/\D/g, '');
		if (!id || id.length < 5) {
			addError = 'נא להזין מספר כרטיס תקין (לפחות 5 ספרות)';
			return;
		}
		adding = true;
		addError = '';
		try {
			const fuelRes = await fetch(`/api/fuel/${encodeURIComponent(id)}`);
			if (!fuelRes.ok) {
				addError = (await fuelRes.text()) || `שגיאה ${fuelRes.status}`;
				return;
			}
			const fuelData = await fuelRes.json();

			const payload: SavedCard = {
				id,
				holderName: cards.find((c) => c.id === id)?.holderName ?? '',
				lastFetched: new Date().toISOString(),
				data: fuelData
			};

			const saveRes = await fetch(`/api/cards${baseParam}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (saveRes.ok) {
				cards = await saveRes.json();
				addInput = '';
				showToast(cards.some((c) => c.id === id && c.holderName === '') ? 'כרטיס נוסף ✓' : 'כרטיס עודכן ✓');
			}
		} catch {
			addError = 'שגיאת רשת — ודא חיבור לאינטרנט';
		} finally {
			adding = false;
		}
	}

	async function deleteCard(id: string) {
		await fetch(`/api/cards/${encodeURIComponent(id)}${baseParam}`, { method: 'DELETE' });
		cards = cards.filter((c) => c.id !== id);
		showToast('כרטיס נמחק');
	}

	async function updateHolder(id: string, name: string) {
		const res = await fetch(`/api/cards/${encodeURIComponent(id)}${baseParam}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ holderName: name })
		});
		if (res.ok) {
			const updated: SavedCard = await res.json();
			cards = cards.map((c) => (c.id === id ? { ...c, holderName: updated.holderName } : c));
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') addCard();
	}

	// ── Bulk edit ──
	let bulkMode = false;
	let selectedIds = new Set<string>();
	let bulkName = '';
	let bulkApplying = false;

	$: allSelected = displayedCards.length > 0 && displayedCards.every((c) => selectedIds.has(c.id));

	function toggleBulkMode() {
		bulkMode = !bulkMode;
		selectedIds = new Set();
		bulkName = '';
	}

	function toggleSelect(id: string) {
		const s = new Set(selectedIds);
		if (s.has(id)) s.delete(id); else s.add(id);
		selectedIds = s;
	}

	function selectAll() {
		if (allSelected) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(displayedCards.map((c) => c.id));
		}
	}

	async function bulkApply() {
		const name = bulkName.trim();
		if (!name || selectedIds.size === 0) return;
		bulkApplying = true;
		try {
			await Promise.all([...selectedIds].map((id) => updateHolder(id, name)));
			showToast(`שם עודכן ל‑${selectedIds.size} כרטיסים ✓`);
			bulkMode = false;
			selectedIds = new Set();
			bulkName = '';
		} finally {
			bulkApplying = false;
		}
	}

	function showToast(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2500);
	}

	// ── Export ──
	function buildExportText(src: SavedCard[]): string {
		const benzin = src.filter((c) => {
			const n = (c.data?.cardName ?? '').toLowerCase();
			return /בנזין|gasoline|95/i.test(n);
		});
		const solar = src.filter((c) => {
			const n = (c.data?.cardName ?? '').toLowerCase();
			return /סולר|diesel/i.test(n);
		});
		const other = src.filter((c) => {
			const n = (c.data?.cardName ?? '').toLowerCase();
			return !/בנזין|gasoline|95|סולר|diesel/i.test(n);
		});

		function fmt(rem: number): string {
			if (rem == null || isNaN(rem)) return '—';
			return rem.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ל'";
		}
		function section(label: string, group: SavedCard[]): string {
			if (group.length === 0) return '';
			const rows = group
				.map((c) => `${c.id}  ${fmt(Number(c.data?.remainingLiters ?? 0))}`)
				.join('\n');
			return `${label} ${group.length}:\n${rows}`;
		}

		return [
			section('בנזין', benzin),
			section('סולר', solar),
			section('אחר', other)
		].filter(Boolean).join('\n\n');
	}

	async function copyExport() {
		const text = buildExportText(cards);
		if (!text) { showToast('אין כרטיסים'); return; }
		try {
			await navigator.clipboard.writeText(text);
			showToast('הטקסט הועתק ✓');
		} catch {
			// fallback
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
			showToast('הטקסט הועתק ✓');
		}
	}
</script>

<svelte:head>
	<title>Goodi – ניהול כרטיסי דלק</title>
</svelte:head>

<div class="app">
	<!-- ══ Header ══ -->
	<header class="app-header">
		<div class="header-inner">
			<div class="logo">
				<span class="logo-emoji">⛽</span>
				<div>
					<h1>ניהול כרטיסי דלק</h1>
					<p class="logo-sub">Goodi Fuel Control</p>
				</div>
			</div>
			<div class="header-actions">
				{#if isAdmin}
					<div class="base-switcher" role="group" aria-label="בחר בסיס">
						<button
							class="base-btn"
							class:active={viewBase === '1'}
							on:click={() => switchBase('1')}
						>בסיס 1</button>
						<button
							class="base-btn"
							class:active={viewBase === '2'}
							on:click={() => switchBase('2')}
						>בסיס 2</button>
					</div>
				{/if}
				{#if cards.length > 0}
					<button
						class="btn-header-icon"
						on:click={copyExport}
						title="ייצוא לטקסט"
						aria-label="ייצא סיכום"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
						</svg>
					</button>
					<button
						class="btn-refresh-all"
						on:click={refreshAll}
						disabled={refreshingIds.size > 0}
						title="רענן את כל הכרטיסים"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							width="16"
							height="16"
							class:spin={refreshingIds.size > 0}
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						<span>רענן הכל</span>
					</button>
				{/if}
				{#if isAdmin}
					<a href="/admin" class="btn-header-icon" title="ניהול הרשאות">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
							<circle cx="9" cy="7" r="4"/>
							<path stroke-linecap="round" stroke-linejoin="round" d="M23 21v-2a4 4 0 0 0-3-3.87"/>
							<path stroke-linecap="round" stroke-linejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75"/>
						</svg>
					</a>
				{/if}
				<button class="btn-header-icon" title="יציאה" on:click={logout}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
					</svg>
				</button>
			</div>
		</div>
	</header>

	<main>
		<!-- ══ Add card panel ══ -->
		<div class="add-panel">
			<p class="add-label">הוסף כרטיס</p>
			<div class="add-row">
				<input
					type="text"
					inputmode="numeric"
					placeholder="מספר כרטיס..."
					bind:value={addInput}
					on:keydown={onKeydown}
					maxlength="15"
					disabled={adding}
					dir="ltr"
					aria-label="מספר כרטיס"
				/>
				<button class="btn-add" on:click={addCard} disabled={adding}>
					{#if adding}
						<span class="spinner"></span>
					{:else}
						הוסף
					{/if}
				</button>
			</div>
			{#if addError}
				<div class="add-error" role="alert">{addError}</div>
			{/if}
		</div>

		<!-- ══ Cards grid ══ -->
		{#if cards.length === 0}
			<div class="empty-state">
				<div class="empty-icon">⛽</div>
				<h2>אין כרטיסים שמורים</h2>
				<p>הכנס מספר כרטיס כדי להתחיל</p>
			</div>
		{:else}
			<!-- Filter bar -->
			<div class="filter-bar">
				<div class="filter-group">
					<span class="filter-label">דלק</span>
					<button class="filter-btn" class:active={fuelFilter === 'all'} on:click={() => (fuelFilter = 'all')}>הכל</button>
					<button class="filter-btn diesel" class:active={fuelFilter === 'diesel'} on:click={() => (fuelFilter = 'diesel')}>סולר 🛢</button>
					<button class="filter-btn gas" class:active={fuelFilter === 'gasoline'} on:click={() => (fuelFilter = 'gasoline')}>בנזין ⛽</button>
				</div>
				<div class="filter-sep"></div>
				<div class="filter-group">
					<span class="filter-label">מילוי</span>
					<button class="filter-btn" class:active={fillFilter === 'all'} on:click={() => (fillFilter = 'all')}>הכל</button>
					<button class="filter-btn full" class:active={fillFilter === 'full'} on:click={() => (fillFilter = 'full')}>מלא &gt;50ל'</button>
					<button class="filter-btn partial" class:active={fillFilter === 'partial'} on:click={() => (fillFilter = 'partial')}>1–50ל'</button>
					<button class="filter-btn empty" class:active={fillFilter === 'empty'} on:click={() => (fillFilter = 'empty')}>ריק &lt;1ל'</button>
				</div>
				<span class="filter-count">{filteredCards.length} / {cards.length}</span>
				<button
					class="btn-bulk-toggle"
					class:active={bulkMode}
					on:click={toggleBulkMode}
					title="עריכה קבוצתית של שם מחזיק"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
					</svg>
					עריכה קבוצתית
				</button>
			</div>

			<!-- Bulk edit panel -->
			{#if bulkMode}
				<div class="bulk-panel">
					<label class="bulk-select-all">
						<input type="checkbox" checked={allSelected} on:change={selectAll} />
						<span>בחר הכל ({displayedCards.length})</span>
					</label>
					{#if selectedIds.size > 0}
						<span class="bulk-count-badge">{selectedIds.size} נבחרו</span>
					{/if}
					<div class="bulk-name-row">
						<input
							type="text"
							placeholder="שם מחזיק הכרטיסים..."
							bind:value={bulkName}
							class="bulk-name-input"
							on:keydown={(e) => e.key === 'Enter' && bulkApply()}
						/>
						<button
							class="btn-bulk-apply"
							on:click={bulkApply}
							disabled={!bulkName.trim() || selectedIds.size === 0 || bulkApplying}
						>
							{#if bulkApplying}
								<span class="spinner"></span>
							{:else}
								החל
							{/if}
						</button>
					</div>
				</div>
			{/if}

			<!-- Card search -->
			<div class="card-search-wrap">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" class="search-icon" aria-hidden="true">
					<circle cx="11" cy="11" r="8"/>
					<path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
				</svg>
				<input
					type="text"
					placeholder="חיפוש לפי שם או מספר כרטיס..."
					bind:value={cardSearch}
					class="card-search-input"
				/>
				{#if cardSearch}
					<button class="search-clear" on:click={() => (cardSearch = '')} aria-label="נקה חיפוש">×</button>
				{/if}
			</div>

			{#if displayedCards.length === 0}
				<div class="empty-state">
					<div class="empty-icon">🔍</div>
					<h2>אין כרטיסים תואמים</h2>
					<p>שנה את הפילטרים או מחרוזת החיפוש כדי לראות כרטיסים</p>
				</div>
			{:else}
				<div class="cards-grid">
					{#each displayedCards as card (card.id)}
						<div
							class="card-select-wrap"
							class:bulk-active={bulkMode}
							class:is-selected={selectedIds.has(card.id)}
							on:click={() => bulkMode && toggleSelect(card.id)}
							on:keydown={(e) => bulkMode && e.key === ' ' && toggleSelect(card.id)}
							role={bulkMode ? 'checkbox' : undefined}
							aria-checked={bulkMode ? selectedIds.has(card.id) : undefined}
							tabindex={bulkMode ? 0 : undefined}
						>
							{#if bulkMode}
								<div class="card-checkbox" aria-hidden="true">
									{#if selectedIds.has(card.id)}
										<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="14" height="14">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
										</svg>
									{/if}
								</div>
							{/if}
							<CardItem
								{card}
								refreshing={refreshingIds.has(card.id)}
								on:delete={(e) => deleteCard(e.detail)}
								on:updateHolder={(e) => updateHolder(e.detail.id, e.detail.name)}
								on:refresh={(e) => refreshCard(e.detail)}
							/>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</main>

	<!-- ══ Toast ══ -->
	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}
</div>

<style>
	/* ── Layout ── */
	.app {
		width: 100%;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* ── App header ── */
	.app-header {
		width: 100%;
		background: linear-gradient(160deg, #0f172a 0%, #1a2d4a 100%);
		color: #fff;
		box-shadow: 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.35);
		position: sticky;
		top: 0;
		z-index: 50;
	}

	.header-inner {
		max-width: 1200px;
		margin: 0 auto;
		padding: 14px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* ── Base switcher (admin only) ── */
	.base-switcher {
		display: flex;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		overflow: hidden;
		gap: 1px;
	}
	.base-btn {
		padding: 5px 14px;
		font-size: 12px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.55);
		background: none;
		border: none;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
		white-space: nowrap;
		letter-spacing: 0.2px;
	}
	.base-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
	.base-btn.active { background: #2563eb; color: #fff; }

	.btn-header-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: rgba(255, 255, 255, 0.09);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.85);
		transition: background 0.15s;
		text-decoration: none;
		flex-shrink: 0;
	}
	.btn-header-icon:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }

	.logo {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.logo-emoji {
		font-size: 32px;
		line-height: 1;
	}

	.logo h1 {
		font-size: 20px;
		font-weight: 800;
		line-height: 1.2;
		letter-spacing: -0.3px;
	}

	.logo-sub {
		font-size: 11px;
		opacity: 0.6;
		font-weight: 500;
		letter-spacing: 0.3px;
	}

	.btn-refresh-all {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.09);
		color: rgba(255, 255, 255, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 10px;
		padding: 7px 13px;
		font-size: 13px;
		font-weight: 600;
		transition: background 0.15s;
		letter-spacing: 0.1px;
	}

	.btn-refresh-all:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.25);
	}

	.btn-refresh-all:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spin {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Main ── */
	main {
		flex: 1;
		width: 100%;
		max-width: 1200px;
		align-self: center;
		padding: 20px 16px 48px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* ── Add card panel ── */
	.add-panel {
		background: #fff;
		border-radius: 16px;
		padding: 16px 18px;
		box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.07));
		display: flex;
		flex-direction: column;
		gap: 10px;
		border: 1px solid #f1f5f9;
	}
	.add-label {
		font-size: 11px;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.add-row {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.add-row input {
		flex: 1;
		height: 44px;
		padding: 0 14px;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		font-size: 16px;
		font-family: 'Courier New', monospace;
		text-align: left;
		direction: ltr;
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
		background: #f8fafc;
		color: #0f172a;
		width: 100%;
	}
	.add-row input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
		background: #fff;
	}
	.add-row input:disabled { opacity: 0.6; }
	.add-error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 13px;
	}
	.btn-add {
		height: 44px;
		padding: 0 20px;
		background: linear-gradient(135deg, #2563eb, #1d4ed8);
		color: #fff;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 80px;
		transition: transform 0.1s, box-shadow 0.15s;
		box-shadow: 0 4px 12px rgba(37,99,235,0.3);
		flex-shrink: 0;
	}

	.btn-add:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 6px 20px rgba(37,99,235,0.4);
	}

	.btn-add:disabled {
		opacity: 0.65;
		cursor: not-allowed;
		box-shadow: none;
	}

	/* ── Card search ── */
	.card-search-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}
	.search-icon {
		position: absolute;
		right: 12px;
		color: #94a3b8;
		pointer-events: none;
		flex-shrink: 0;
	}
	.card-search-input {
		width: 100%;
		height: 40px;
		padding: 0 40px 0 36px;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		font-size: 14px;
		outline: none;
		background: #fff;
		color: #0f172a;
		transition: border-color 0.2s, box-shadow 0.2s;
	}
	.card-search-input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
	}
	.card-search-input::placeholder { color: #94a3b8; }
	.search-clear {
		position: absolute;
		left: 10px;
		background: none;
		border: none;
		font-size: 18px;
		color: #94a3b8;
		cursor: pointer;
		line-height: 1;
		padding: 0 4px;
	}
	.search-clear:hover { color: #475569; }

	/* ── Bulk edit ── */
	.btn-bulk-toggle {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px 10px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		color: #64748b;
		background: #f1f5f9;
		transition: background 0.13s, color 0.13s;
		white-space: nowrap;
		flex-shrink: 0;
	}
	.btn-bulk-toggle:hover { background: #e2e8f0; }
	.btn-bulk-toggle.active { background: #7c3aed; color: #fff; }

	.bulk-panel {
		background: #faf5ff;
		border: 1.5px solid #ddd6fe;
		border-radius: 14px;
		padding: 14px 16px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.bulk-select-all {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		font-weight: 600;
		color: #4c1d95;
		cursor: pointer;
		user-select: none;
	}
	.bulk-select-all input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #7c3aed;
	}
	.bulk-count-badge {
		background: #7c3aed;
		color: #fff;
		border-radius: 20px;
		padding: 2px 10px;
		font-size: 12px;
		font-weight: 700;
	}
	.bulk-name-row {
		display: flex;
		gap: 8px;
		align-items: center;
		flex: 1;
		min-width: 220px;
	}
	.bulk-name-input {
		flex: 1;
		height: 38px;
		border: 1.5px solid #c4b5fd;
		border-radius: 10px;
		padding: 0 12px;
		font-size: 14px;
		outline: none;
		background: #fff;
		color: #0f172a;
		transition: border-color 0.2s, box-shadow 0.2s;
	}
	.bulk-name-input:focus {
		border-color: #7c3aed;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
	}
	.btn-bulk-apply {
		height: 38px;
		padding: 0 18px;
		background: #7c3aed;
		color: #fff;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 64px;
		transition: background 0.15s;
		flex-shrink: 0;
	}
	.btn-bulk-apply:hover:not(:disabled) { background: #6d28d9; }
	.btn-bulk-apply:disabled { opacity: 0.55; cursor: not-allowed; }

	/* ── Card selection wrapper ── */
	.card-select-wrap {
		position: relative;
	}
	.card-select-wrap.bulk-active {
		cursor: pointer;
		border-radius: 18px;
		transition: box-shadow 0.15s;
	}
	.card-select-wrap.bulk-active:hover {
		box-shadow: 0 0 0 2px #c4b5fd;
	}
	.card-select-wrap.is-selected {
		box-shadow: 0 0 0 3px #7c3aed !important;
	}
	.card-checkbox {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 10;
		width: 22px;
		height: 22px;
		border-radius: 6px;
		background: #fff;
		border: 2px solid #c4b5fd;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s, border-color 0.15s;
		pointer-events: none;
	}
	.is-selected .card-checkbox {
		background: #7c3aed;
		border-color: #7c3aed;
	}

	/* ── Btn add ── */

	/* ── Spinner ── */
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	/* ── Section heading ── */
	.section-heading {
		display: flex;
		align-items: center;
	}

	.section-heading h2 {
		font-size: 15px;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.count {
		color: #94a3b8;
		font-weight: 500;
	}

	/* ── Filter bar ── */
	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		background: #fff;
		border: 1px solid #e8edf3;
		border-radius: 14px;
		padding: 10px 14px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.04);
	}
	.filter-group {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}
	.filter-label {
		font-size: 10px;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		margin-left: 4px;
	}
	.filter-sep {
		width: 1px;
		height: 18px;
		background: #e8edf3;
		margin: 0 4px;
	}
	.filter-btn {
		padding: 4px 13px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		color: #64748b;
		background: #f1f5f9;
		transition: background 0.13s, color 0.13s, transform 0.1s;
		white-space: nowrap;
		border: 1px solid transparent;
	}
	.filter-btn:hover { background: #e2e8f0; transform: translateY(-0.5px); }
	.filter-btn.active { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
	.filter-btn.diesel.active { background: #92400e; color: #fff; border-color: #92400e; }
	.filter-btn.gas.active { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
	.filter-btn.full.active { background: #059669; color: #fff; border-color: #059669; }
	.filter-btn.partial.active { background: #d97706; color: #fff; border-color: #d97706; }
	.filter-btn.empty.active { background: #dc2626; color: #fff; border-color: #dc2626; }
	.filter-count {
		margin-right: auto;
		font-size: 12px;
		color: #94a3b8;
		font-weight: 600;
	}

	/* ── Cards grid ── */
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
		gap: 16px;
	}

	/* ── Empty state ── */
	.empty-state {
		background: #fff;
		border-radius: 20px;
		border: 1px solid #f1f5f9;
		padding: 72px 24px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.06);
	}

	.empty-icon {
		font-size: 60px;
		opacity: 0.35;
		filter: grayscale(0.3);
	}

	.empty-state h2 {
		font-size: 20px;
		color: #1e293b;
		font-weight: 700;
		letter-spacing: -0.3px;
	}

	.empty-state p {
		font-size: 14px;
		color: #94a3b8;
		max-width: 280px;
		line-height: 1.6;
		font-weight: 500;
	}

	/* ── Toast ── */
	.toast {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		background: #0f172a;
		color: #fff;
		padding: 11px 24px;
		border-radius: 30px;
		font-size: 14px;
		font-weight: 600;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
		z-index: 200;
		animation: fadeInUp 0.25s ease;
		pointer-events: none;
		white-space: nowrap;
		letter-spacing: 0.1px;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	/* ── Responsive ── */
	@media (max-width: 640px) {
		/* Filter bar scrolls horizontally on small screens */
		.filter-bar {
			overflow-x: auto;
			flex-wrap: nowrap;
			scrollbar-width: none;
			-webkit-overflow-scrolling: touch;
			padding: 8px 12px;
		}
		.filter-bar::-webkit-scrollbar {
			display: none;
		}
		.filter-sep {
			display: none;
		}
		.filter-count {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.header-inner {
			padding: 11px 14px;
		}
		.logo h1 {
			font-size: 16px;
		}
		.logo-emoji {
			font-size: 26px;
		}
		.logo-sub {
			display: none;
		}
		.btn-refresh-all span {
			display: none;
		}
		.btn-refresh-all {
			padding: 8px;
			min-width: 36px;
			justify-content: center;
		}
		main {
			padding: 12px 10px calc(env(safe-area-inset-bottom, 0px) + 56px);
			gap: 12px;
		}
		.search-panel {
			padding: 12px;
		}
		.cards-grid {
			grid-template-columns: 1fr;
			gap: 10px;
		}
		.toast {
			bottom: calc(env(safe-area-inset-bottom, 0px) + 20px);
			font-size: 13px;
			padding: 9px 18px;
		}
	}
</style>

