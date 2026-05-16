<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import CardItem from '$lib/components/CardItem.svelte';
	import type { SavedCard } from '$lib/types';
	import type { PageData } from './$types';

	export let data: PageData;
	$: phone = data.phone;
	$: isAdmin = data.isAdmin;

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
			const res = await fetch('/api/cards');
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

			const saveRes = await fetch('/api/cards', {
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

			const saveRes = await fetch('/api/cards', {
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
		await fetch(`/api/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
		cards = cards.filter((c) => c.id !== id);
		showToast('כרטיס נמחק');
	}

	async function updateHolder(id: string, name: string) {
		const res = await fetch(`/api/cards/${encodeURIComponent(id)}`, {
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

	function showToast(msg: string) {
		toast = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2500);
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
				{#if cards.length > 0}
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
			</div>

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
						<CardItem
							{card}
							refreshing={refreshingIds.has(card.id)}
							on:delete={(e) => deleteCard(e.detail)}
							on:updateHolder={(e) => updateHolder(e.detail.id, e.detail.name)}
							on:refresh={(e) => refreshCard(e.detail)}
						/>
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
		background: #0f172a;
		color: #fff;
		box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 12px rgba(0, 0, 0, 0.3);
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

	.btn-header-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.9);
		transition: background 0.15s;
		text-decoration: none;
		flex-shrink: 0;
	}
	.btn-header-icon:hover { background: rgba(255, 255, 255, 0.2); }

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
		font-weight: 700;
		line-height: 1.2;
	}

	.logo-sub {
		font-size: 12px;
		opacity: 0.75;
	}

	.btn-refresh-all {
		display: flex;
		align-items: center;
		gap: 6px;
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		padding: 7px 13px;
		font-size: 13px;
		font-weight: 500;
		transition: background 0.15s;
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
		border-radius: 14px;
		padding: 14px 16px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07), 0 4px 12px rgba(0, 0, 0, 0.04);
		display: flex;
		flex-direction: column;
		gap: 10px;
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
		background: #2563eb;
		color: #fff;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 80px;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.btn-add:hover:not(:disabled) {
		background: #1d4ed8;
	}

	.btn-add:disabled {
		opacity: 0.65;
		cursor: not-allowed;
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
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 10px 14px;
	}
	.filter-group {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}
	.filter-label {
		font-size: 11px;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-left: 4px;
	}
	.filter-sep {
		width: 1px;
		height: 20px;
		background: #e2e8f0;
		margin: 0 4px;
	}
	.filter-btn {
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 600;
		color: #64748b;
		background: #f1f5f9;
		transition: background 0.13s, color 0.13s;
		white-space: nowrap;
	}
	.filter-btn:hover { background: #e2e8f0; }
	.filter-btn.active { background: #1d4ed8; color: #fff; }
	.filter-btn.diesel.active { background: #92400e; color: #fff; }
	.filter-btn.gas.active { background: #1d4ed8; color: #fff; }
	.filter-btn.full.active { background: #15803d; color: #fff; }
	.filter-btn.partial.active { background: #ea580c; color: #fff; }
	.filter-btn.empty.active { background: #dc2626; color: #fff; }
	.filter-count {
		margin-right: auto;
		font-size: 12px;
		color: #94a3b8;
		font-weight: 600;
	}

	/* ── Cards grid ── */
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 14px;
	}

	/* ── Empty state ── */
	.empty-state {
		background: #fff;
		border-radius: 20px;
		padding: 60px 24px;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	}

	.empty-icon {
		font-size: 56px;
		opacity: 0.4;
	}

	.empty-state h2 {
		font-size: 20px;
		color: #334155;
		font-weight: 600;
	}

	.empty-state p {
		font-size: 14px;
		color: #94a3b8;
		max-width: 280px;
		line-height: 1.5;
	}

	/* ── Toast ── */
	.toast {
		position: fixed;
		bottom: 24px;
		left: 50%;
		transform: translateX(-50%);
		background: #0f172a;
		color: #fff;
		padding: 10px 22px;
		border-radius: 30px;
		font-size: 14px;
		font-weight: 500;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		z-index: 200;
		animation: fadeInUp 0.25s ease;
		pointer-events: none;
		white-space: nowrap;
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

