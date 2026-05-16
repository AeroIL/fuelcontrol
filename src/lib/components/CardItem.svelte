<script lang="ts">
	import type { SavedCard } from '$lib/types';
	import { createEventDispatcher } from 'svelte';

	export let card: SavedCard;
	export let refreshing = false;

	const dispatch = createEventDispatcher<{
		delete: string;
		updateHolder: { id: string; name: string };
		refresh: string;
	}>();

	let editingName = false;
	let nameInput = card.holderName;
	let deleteConfirm = false;
	let txOpen = false;

	$: d = card.data;
	$: txList = d.transactions ?? [];
	$: lastTx = txList[0] ?? null;
	$: fuelLabel = (() => {
		const n = (d.cardName || '').toLowerCase();
		if (/סולר|diesel/i.test(n)) return { text: 'סולר 🛢', cls: 'fuel-diesel' };
		if (/95/.test(n)) return { text: 'בנזין 95 ⛽', cls: 'fuel-95' };
		if (/בנזין/.test(n)) return { text: 'בנזין ⛽', cls: 'fuel-95' };
		return null;
	})();
	$: slice = (d.usedLiters || 0) + (d.remainingLiters || 0);
	$: remainPct = slice > 0 ? Math.min(100, (d.remainingLiters / slice) * 100) : 0;
	$: gaugeColor =
		remainPct > 50 ? '#16a34a' : remainPct > 25 ? '#ea580c' : '#dc2626';

	function fmt(n: number): string {
		if (n == null || isNaN(n)) return '—';
		return n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	function fmtDate(s: string): string {
		if (!s) return '—';
		const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
		if (m) return `${m[2].padStart(2, '0')}/${m[1].padStart(2, '0')}/${m[3]}`;
		try {
			const dt = new Date(s);
			if (!isNaN(dt.getTime()))
				return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
		} catch {
			// ignore
		}
		return s.split('T')[0];
	}

	function fmtRelative(iso: string): string {
		if (!iso) return '';
		try {
			const diff = Date.now() - new Date(iso).getTime();
			const mins = Math.floor(diff / 60000);
			if (mins < 1) return 'עכשיו';
			if (mins < 60) return `לפני ${mins} דק'`;
			const hrs = Math.floor(mins / 60);
			if (hrs < 24) return `לפני ${hrs} שע'`;
			return `לפני ${Math.floor(hrs / 24)} ימים`;
		} catch {
			return '';
		}
	}

	function saveName() {
		dispatch('updateHolder', { id: card.id, name: nameInput.trim() });
		editingName = false;
	}

	function onNameKey(e: KeyboardEvent) {
		if (e.key === 'Enter') saveName();
		if (e.key === 'Escape') {
			editingName = false;
			nameInput = card.holderName;
		}
	}
</script>

<article class="card" class:refreshing>

	<!-- top bar: name + actions -->
	<header class="card-top">
		<div class="name-area">
			{#if editingName}
				<input
					class="name-input"
					bind:value={nameInput}
					on:keydown={onNameKey}
					on:blur={saveName}
					placeholder="שם מחזיק הכרטיס"
					maxlength="100"
					autofocus
				/>
			{:else}
				<button class="name-btn" on:click={() => { nameInput = card.holderName; editingName = true; }}>
					<span class:muted={!card.holderName}>{card.holderName || 'הוסף שם'}</span>
					<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
						<path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
					</svg>
				</button>
			{/if}
		</div>

		<div class="actions">
			<button
				class="icon-btn"
				class:spin={refreshing}
				disabled={refreshing}
				on:click={() => dispatch('refresh', card.id)}
				title="רענן"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
				</svg>
			</button>

			{#if !deleteConfirm}
				<button class="icon-btn danger" on:click={() => (deleteConfirm = true)} title="מחק">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
						<polyline points="3 6 5 6 21 6"/>
						<path d="M19 6l-1 14H6L5 6"/>
						<path d="M10 11v6M14 11v6"/>
						<path d="M9 6V4h6v2"/>
					</svg>
				</button>
			{:else}
				<div class="del-row">
					<span>מחק?</span>
					<button class="btn-yes" on:click={() => dispatch('delete', card.id)}>כן</button>
					<button class="btn-no" on:click={() => (deleteConfirm = false)}>לא</button>
				</div>
			{/if}
		</div>
	</header>

	<!-- card id + type strip -->
	<div class="id-strip">
		<span class="card-id" dir="ltr">{card.id}</span>
		<div class="badges">
			{#if fuelLabel}<span class="badge {fuelLabel.cls}">{fuelLabel.text}</span>{/if}
			{#if d.cardType}<span class="badge">{d.cardType}</span>{/if}
			<span class="badge" class:active={d.isActive}>{d.isActive ? 'פעיל' : 'לא פעיל'}</span>
		</div>
	</div>

	<!-- remaining fuel -->
	{#if slice > 0}
		<div class="fuel-section">
			<div class="fuel-row">
				<span class="fuel-label">⛽ נותרו</span>
				<span class="fuel-val" style="color:{gaugeColor}">{fmt(d.remainingLiters)} ל'</span>
			</div>
			<div class="gauge-track">
				<div class="gauge-fill" style="width:{remainPct}%;background:{gaugeColor}"></div>
			</div>
			<div class="fuel-sub">
				<span>שומשו {fmt(d.usedLiters)} ל'</span>
				<span>{Math.round(remainPct)}%</span>
			</div>
		</div>
	{/if}

	<!-- last usage -->
	{#if lastTx}
		<div class="last-section">
			<p class="section-label">שימוש אחרון</p>
			<div class="last-row">
				<span class="last-date">{fmtDate(lastTx.date)}{lastTx.time ? ` · ${lastTx.time}` : ''}</span>
				<span class="last-liters">{fmt(lastTx.litersOrCost)} ל'</span>
			</div>
			{#if lastTx.stationName}
				<p class="last-station">📍 {lastTx.stationName}{lastTx.branchNumber ? ` (${lastTx.branchNumber})` : ''}</p>
			{/if}
			{#if lastTx.vehicleNumber}
				<p class="last-vehicle">🚗 {lastTx.vehicleNumber}</p>
			{/if}
		</div>
	{/if}

	<!-- transactions dropdown -->
	{#if txList.length > 0}
		<div class="tx-section">
			<button class="tx-toggle" on:click={() => (txOpen = !txOpen)}>
				<span>🧾 עסקאות ({txList.length})</span>
				<span class="chevron" class:open={txOpen}>▾</span>
			</button>
			{#if txOpen}
				<div class="tx-table-wrap">
					<table class="tx-table">
						<thead>
							<tr>
								<th>תאריך / שעה</th>
								<th>רכב</th>
								<th>תחנה</th>
								<th>חברה</th>
								<th>סוג</th>
								<th>ליטר</th>
							</tr>
						</thead>
						<tbody>
							{#each txList as tx}
								<tr>
									<td class="col-date">
										<span>{fmtDate(tx.date)}</span>
										{#if tx.time}<span class="col-time">{tx.time}</span>{/if}
									</td>
									<td class="col-vehicle" dir="ltr">{tx.vehicleNumber || '—'}</td>
									<td class="col-station">
										{tx.stationName || '—'}
										{#if tx.branchNumber}<span class="branch">#{tx.branchNumber}</span>{/if}
									</td>
									<td class="col-fuel">{tx.fuelType || '—'}</td>
									<td class="col-type">{tx.transactionType || '—'}</td>
									<td class="col-liters">{fmt(tx.litersOrCost)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- footer -->
	<div class="card-footer">
		<span class="updated">{fmtRelative(card.lastFetched)}</span>
	</div>

</article>

<style>
	.card {
		background: #fff;
		border-radius: 14px;
		border: 1px solid #e2e8f0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition: box-shadow 0.18s, transform 0.18s;
	}
	.card:hover {
		box-shadow: 0 6px 20px rgba(0,0,0,.09);
		transform: translateY(-1px);
	}
	.card.refreshing { opacity: 0.6; pointer-events: none; }

	/* top bar */
	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px 10px;
		gap: 8px;
		border-bottom: 1px solid #f1f5f9;
	}
	.name-area { flex: 1; min-width: 0; }
	.name-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 14px;
		font-weight: 600;
		color: #1e293b;
		background: none;
		padding: 2px 4px;
		border-radius: 4px;
		max-width: 100%;
		text-align: right;
		transition: background 0.13s;
	}
	.name-btn:hover { background: #f1f5f9; }
	.name-btn .muted { color: #94a3b8; font-weight: 400; font-style: italic; }
	.name-input {
		border: 1.5px solid #93c5fd;
		border-radius: 6px;
		font-size: 14px;
		padding: 4px 8px;
		width: 100%;
		outline: none;
		color: #1e293b;
	}
	.name-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }

	/* actions */
	.actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
	.icon-btn {
		width: 30px; height: 30px;
		border-radius: 7px;
		display: flex; align-items: center; justify-content: center;
		color: #64748b;
		background: none;
		transition: background 0.13s, color 0.13s;
	}
	.icon-btn:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }
	.icon-btn.danger:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }
	.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.spin svg { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.del-row {
		display: flex; align-items: center; gap: 4px;
		background: #fef2f2; border-radius: 7px;
		padding: 3px 8px; font-size: 12px; color: #b91c1c;
	}
	.btn-yes {
		background: #dc2626; color: #fff;
		border-radius: 4px; padding: 2px 8px;
		font-size: 12px; font-weight: 600;
	}
	.btn-no {
		background: #f1f5f9; color: #475569;
		border-radius: 4px; padding: 2px 8px; font-size: 12px;
	}

	/* id strip */
	.id-strip {
		display: flex; align-items: center; justify-content: space-between;
		padding: 7px 14px;
		background: #f8fafc;
		border-bottom: 1px solid #f1f5f9;
	}
	.card-id {
		font-family: 'Courier New', monospace;
		font-size: 13px; font-weight: 700;
		color: #475569; letter-spacing: 0.5px;
	}
	.badges { display: flex; gap: 5px; }
	.badge {
		font-size: 11px; font-weight: 600;
		padding: 2px 8px; border-radius: 20px;
		background: #e2e8f0; color: #475569;
	}
	.badge.active { background: #dcfce7; color: #15803d; }

	/* fuel section */
	.fuel-section {
		padding: 14px 14px 10px;
		border-bottom: 1px solid #f1f5f9;
	}
	.fuel-row {
		display: flex; justify-content: space-between; align-items: baseline;
		margin-bottom: 8px;
	}
	.fuel-label { font-size: 13px; color: #64748b; font-weight: 500; }
	.fuel-val { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
	.gauge-track {
		height: 7px; background: #e2e8f0; border-radius: 99px; overflow: hidden;
	}
	.gauge-fill {
		height: 100%; border-radius: 99px;
		transition: width 0.4s ease;
	}
	.fuel-sub {
		display: flex; justify-content: space-between;
		font-size: 11px; color: #94a3b8; margin-top: 5px;
	}

	/* last section */
	.last-section {
		padding: 12px 14px;
		border-bottom: 1px solid #f1f5f9;
	}
	.section-label {
		font-size: 10px; font-weight: 700; color: #94a3b8;
		text-transform: uppercase; letter-spacing: 0.7px;
		margin-bottom: 6px;
	}
	.last-row {
		display: flex; justify-content: space-between; align-items: baseline;
		margin-bottom: 4px;
	}
	.last-date { font-size: 14px; font-weight: 600; color: #1e293b; }
	.last-liters { font-size: 16px; font-weight: 700; color: #1d4ed8; }
	.last-station { font-size: 13px; color: #475569; margin-bottom: 2px; }
	.last-vehicle { font-size: 12px; color: #94a3b8; }

	/* fuel type badges */
	.badge.fuel-diesel { background: #fef9c3; color: #713f12; }
	.badge.fuel-95 { background: #dbeafe; color: #1e40af; }

	/* transactions dropdown */
	.tx-section { border-top: 1px solid #f1f5f9; }
	.tx-toggle {
		width: 100%; display: flex; justify-content: space-between; align-items: center;
		padding: 10px 14px; font-size: 13px; font-weight: 600; color: #475569;
		background: none; text-align: right;
		transition: background 0.13s;
	}
	.tx-toggle:hover { background: #f8fafc; }
	.chevron { font-size: 16px; transition: transform 0.2s; display: inline-block; }
	.chevron.open { transform: rotate(180deg); }

	.tx-table-wrap { overflow-x: auto; border-top: 1px solid #f1f5f9; }
	.tx-table {
		width: 100%; border-collapse: collapse;
		font-size: 12px; text-align: right;
	}
	.tx-table thead tr { background: #f8fafc; }
	.tx-table th {
		padding: 7px 10px; font-size: 11px; font-weight: 700;
		color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;
		white-space: nowrap;
	}
	.tx-table tbody tr { border-top: 1px solid #f1f5f9; transition: background 0.1s; }
	.tx-table tbody tr:hover { background: #f8fafc; }
	.tx-table td { padding: 7px 10px; color: #475569; vertical-align: middle; }
	.col-date { white-space: nowrap; color: #64748b; font-size: 11px; }
	.col-time { display: block; color: #94a3b8; font-size: 10px; }
	.col-vehicle { font-family: 'Courier New', monospace; font-weight: 600; color: #1e293b; white-space: nowrap; }
	.col-station { max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.branch { display: block; font-size: 10px; color: #94a3b8; }
	.col-fuel { white-space: nowrap; color: #475569; }
	.col-type { white-space: nowrap; color: #94a3b8; font-size: 11px; }
	.col-liters { font-weight: 700; color: #1d4ed8; white-space: nowrap; text-align: left; }

	/* footer */
	.card-footer {
		padding: 8px 14px;
	}
	.updated { font-size: 11px; color: #cbd5e1; }
</style>

