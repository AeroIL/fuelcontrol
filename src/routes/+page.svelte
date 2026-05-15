<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import CameraScanner from '$lib/components/CameraScanner.svelte';
	import CardItem from '$lib/components/CardItem.svelte';
	import type { SavedCard } from '$lib/types';

	let cards: SavedCard[] = [];
	let refreshingIds = new Set<string>();
	let searchInput = '';
	let searching = false;
	let searchError = '';
	let showScanner = false;
	let scanFlash = false;
	let toast = '';
	let toastTimer: ReturnType<typeof setTimeout>;

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

	async function searchCard() {
		const id = searchInput.trim().replace(/\D/g, '');
		if (!id || id.length < 5) {
			searchError = 'נא להזין מספר כרטיס תקין (לפחות 5 ספרות)';
			return;
		}
		searching = true;
		searchError = '';
		try {
			const fuelRes = await fetch(`/api/fuel/${encodeURIComponent(id)}`);
			if (!fuelRes.ok) {
				searchError = (await fuelRes.text()) || `שגיאה ${fuelRes.status}`;
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
				searchInput = '';
				showScanner = false;
				showToast(cards.some((c) => c.id === id && c.holderName === '') ? 'כרטיס נוסף ✓' : 'כרטיס עודכן ✓');
			}
		} catch {
			searchError = 'שגיאת רשת — ודא חיבור לאינטרנט';
		} finally {
			searching = false;
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

	function handleScan(e: CustomEvent<string>) {
		searchInput = e.detail;
		scanFlash = true;
		setTimeout(() => (scanFlash = false), 1400);
		searchCard();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') searchCard();
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
		</div>
	</header>

	<main>
		<!-- ══ Search panel ══ -->
		<div class="search-panel">
			<div class="search-row">
				<button
					class="btn-scan-toggle"
					class:active={showScanner}
					on:click={() => (showScanner = !showScanner)}
					title="סרוק ברקוד"
				>
					<span>📷</span>
				</button>

				<input
					type="text"
					inputmode="numeric"
					placeholder="מספר כרטיס…"
					bind:value={searchInput}
					on:keydown={onKeydown}
					class:flash={scanFlash}
					maxlength="15"
					disabled={searching}
					aria-label="מספר כרטיס"
				/>

				<button class="btn-add" on:click={searchCard} disabled={searching}>
					{#if searching}
						<span class="spinner"></span>
					{:else}
						הוסף
					{/if}
				</button>
			</div>

			{#if searchError}
				<div class="search-error" role="alert">{searchError}</div>
			{/if}

			{#if showScanner}
				<div class="scanner-wrap">
					<CameraScanner on:scan={handleScan} />
				</div>
			{/if}
		</div>

		<!-- ══ Cards grid ══ -->
		{#if cards.length === 0}
			<div class="empty-state">
				<div class="empty-icon">⛽</div>
				<h2>אין כרטיסים שמורים</h2>
				<p>סרוק ברקוד כרטיס או הכנס מספר כרטיס כדי להתחיל</p>
			</div>
		{:else}
			<div class="section-heading">
				<h2>כרטיסים שמורים <span class="count">({cards.length})</span></h2>
			</div>
			<div class="cards-grid">
				{#each cards as card (card.id)}
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
	</main>

	<!-- ══ Toast ══ -->
	{#if toast}
		<div class="toast" role="status">{toast}</div>
	{/if}
</div>

<style>
	/* ── Layout ── */
	.app {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	/* ── App header ── */
	.app-header {
		background: linear-gradient(135deg, #0d47a1 0%, #1565c0 60%, #1e88e5 100%);
		color: #fff;
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
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
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
		border-radius: 10px;
		padding: 8px 14px;
		font-size: 13px;
		font-weight: 500;
		transition: background 0.15s;
		backdrop-filter: blur(4px);
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
		max-width: 1200px;
		width: 100%;
		margin: 0 auto;
		padding: 20px 16px 48px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	/* ── Search panel ── */
	.search-panel {
		background: #fff;
		border-radius: 16px;
		padding: 14px 16px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07), 0 4px 12px rgba(0, 0, 0, 0.04);
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.search-row {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.btn-scan-toggle {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		background: #f1f5f9;
		font-size: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.btn-scan-toggle:hover,
	.btn-scan-toggle.active {
		background: #dbeafe;
	}

	.search-row input {
		flex: 1;
		height: 44px;
		padding: 0 14px;
		border: 2px solid #e2e8f0;
		border-radius: 12px;
		font-size: 18px;
		font-family: 'Courier New', monospace;
		text-align: center;
		direction: ltr;
		outline: none;
		transition:
			border-color 0.2s,
			box-shadow 0.2s,
			background 0.25s;
		background: #fff;
		color: #0f172a;
	}

	.search-row input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
	}

	.search-row input.flash {
		background: #f0fdf4;
		border-color: #22c55e;
	}

	.search-row input:disabled {
		opacity: 0.6;
	}

	.btn-add {
		height: 44px;
		padding: 0 22px;
		background: #1d4ed8;
		color: #fff;
		border-radius: 12px;
		font-size: 15px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-width: 88px;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.btn-add:hover:not(:disabled) {
		background: #1e40af;
	}

	.btn-add:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.search-error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 13px;
	}

	.scanner-wrap {
		border-radius: 10px;
		overflow: hidden;
	}

	/* Spinner */
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

	/* ── Cards grid ── */
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
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

	/* ── Mobile tweaks ── */
	@media (max-width: 480px) {
		.logo h1 {
			font-size: 17px;
		}
		.logo-emoji {
			font-size: 26px;
		}
		.cards-grid {
			grid-template-columns: 1fr;
		}
		main {
			padding: 14px 12px 40px;
		}
	}
</style>

