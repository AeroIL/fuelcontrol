<script lang="ts">
	import type { FuelCard } from '$lib/types';

	export let card: FuelCard;

	function fmt(n: number): string {
		return n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
	}

	function fmtDate(d: string): string {
		if (!d) return '—';
		// Try to reformat to a readable Hebrew date
		try {
			const parts = d.split(/[\/\-\.T ]/);
			if (parts.length >= 3) {
				const [m, day, y] = parts; // common US format m/d/y
				return `${day}/${m}/${y}`;
			}
		} catch {
			// ignore
		}
		return d;
	}
</script>

<div class="results-card">
	<!-- Card summary header -->
	<div class="summary-header">
		<div class="summary-badge {card.isActive ? 'active' : 'inactive'}">
			{card.isActive ? 'פעיל' : 'לא פעיל'}
		</div>
		<div class="card-serial">
			<span class="label">מספר כרטיס:</span>
			<span class="value mono">{card.serial}</span>
		</div>
		<div class="card-type">
			<span class="label">סוג כרטיס:</span>
			<span class="value">{card.cardType || '—'}</span>
		</div>
		{#if card.lastUsedDate}
			<div class="card-date">
				<span class="label">שימוש אחרון:</span>
				<span class="value">{fmtDate(card.lastUsedDate)}</span>
			</div>
		{/if}
	</div>

	<!-- Liters overview -->
	<div class="liters-grid">
		<div class="liters-tile total">
			<div class="tile-value">{fmt(card.totalUsedLiters)}</div>
			<div class="tile-label">סה"כ ליטרים שהשתמשו</div>
		</div>
		<div class="liters-tile used">
			<div class="tile-value">{fmt(card.usedLiters)}</div>
			<div class="tile-label">ליטרים שהשתמשו (תקופה)</div>
		</div>
		<div class="liters-tile remaining">
			<div class="tile-value">{fmt(card.remainingLiters)}</div>
			<div class="tile-label">ליטרים שנותרו</div>
		</div>
	</div>

	<!-- Transactions table -->
	{#if card.transactions.length > 0}
		<div class="tx-section">
			<h3 class="tx-title">היסטוריית עסקאות</h3>
			<div class="table-scroll">
				<table class="tx-table">
					<thead>
						<tr>
							<th>מספר רכב</th>
							<th>חברת דלק</th>
							<th>סוג עסקה</th>
							<th>תאריך</th>
							<th>שעה</th>
							<th>תחנה</th>
							<th>סניף</th>
							<th>כמות ליטר</th>
						</tr>
					</thead>
					<tbody>
						{#each card.transactions as tx, i}
							<tr class:alt={i % 2 === 1}>
								<td class="mono">{tx.vehicleNumber || '—'}</td>
								<td>{tx.fuelType || '—'}</td>
								<td>{tx.transactionType || '—'}</td>
								<td class="mono">{fmtDate(tx.date)}</td>
								<td class="mono">{tx.time || '—'}</td>
								<td>{tx.stationName || '—'}</td>
								<td class="mono">{tx.branchNumber || '—'}</td>
								<td class="mono amount">{fmt(tx.litersOrCost)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{:else}
		<p class="no-tx">לא נמצאו עסקאות בטווח התאריכים</p>
	{/if}
</div>

<style>
	.results-card {
		background: var(--card-bg);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		overflow: hidden;
	}

	.summary-header {
		background: linear-gradient(135deg, var(--primary-dark), var(--primary-light));
		color: #fff;
		padding: 20px 24px;
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: center;
	}

	.summary-badge {
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 13px;
		font-weight: 600;
	}

	.summary-badge.active {
		background: rgba(46, 213, 115, 0.25);
		color: #a8f0c6;
		border: 1px solid rgba(46, 213, 115, 0.4);
	}

	.summary-badge.inactive {
		background: rgba(255, 99, 72, 0.25);
		color: #ffb3a7;
		border: 1px solid rgba(255, 99, 72, 0.4);
	}

	.card-serial,
	.card-type,
	.card-date {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.label {
		font-size: 11px;
		opacity: 0.75;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.value {
		font-size: 16px;
		font-weight: 600;
	}

	.mono {
		font-family: 'Courier New', monospace;
		direction: ltr;
	}

	/* Liters grid */
	.liters-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: var(--border);
	}

	.liters-tile {
		background: var(--card-bg);
		padding: 18px 12px;
		text-align: center;
	}

	.tile-value {
		font-size: 22px;
		font-weight: 700;
		font-family: 'Courier New', monospace;
		direction: ltr;
	}

	.liters-tile.total .tile-value {
		color: var(--primary);
	}

	.liters-tile.used .tile-value {
		color: var(--warning);
	}

	.liters-tile.remaining .tile-value {
		color: var(--success);
	}

	.tile-label {
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 4px;
		line-height: 1.3;
	}

	/* Transactions */
	.tx-section {
		padding: 20px 24px;
	}

	.tx-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--text);
		margin-bottom: 14px;
		padding-bottom: 10px;
		border-bottom: 2px solid var(--border);
	}

	.table-scroll {
		overflow-x: auto;
	}

	.tx-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
	}

	.tx-table th {
		background: #f7fafc;
		color: var(--text-muted);
		font-weight: 600;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		padding: 10px 12px;
		text-align: right;
		white-space: nowrap;
		border-bottom: 2px solid var(--border);
	}

	.tx-table td {
		padding: 10px 12px;
		text-align: right;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		white-space: nowrap;
	}

	.tx-table tr.alt td {
		background: #f9fafb;
	}

	.tx-table tr:last-child td {
		border-bottom: none;
	}

	.tx-table .amount {
		color: var(--primary);
		font-weight: 600;
	}

	.no-tx {
		padding: 24px;
		text-align: center;
		color: var(--text-muted);
		font-size: 14px;
	}

	@media (max-width: 600px) {
		.liters-grid {
			grid-template-columns: 1fr;
		}

		.summary-header {
			padding: 16px;
		}

		.tile-value {
			font-size: 18px;
		}
	}
</style>
