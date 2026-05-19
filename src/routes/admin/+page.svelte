<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	type Entry = { phone: string; name: string };
	type AF = { entries1?: Entry[]; entries2?: Entry[]; error?: string } | null;
	$: af = form as AF;
	$: entries1 = af?.entries1 ?? data.entries1;
	$: entries2 = af?.entries2 ?? data.entries2;

	let adding1 = false;
	let adding2 = false;
	let removing = '';
</script>

<svelte:head>
	<title>ניהול הרשאות – Goodi</title>
</svelte:head>

<div class="page">
	<div class="container">
		<header class="top-bar">
			<div class="logo">
				<span>⛽</span>
				<h1>ניהול הרשאות גישה</h1>
			</div>
			<a href="/" class="btn-back">← חזרה</a>
		</header>

		{#if af?.error}
			<p class="error">{af.error}</p>
		{/if}

		<!-- ── Admin section ── -->
		<div class="base-header admin-row">
			<span class="base-badge admin-badge-section">מנהל מערכת</span>
			<span class="base-count">0524746673 · גישה לכל הבסיסים</span>
		</div>

		<!-- ── Base 1 ── -->
		<div class="base-header base1">
			<span class="base-badge">בסיס 1</span>
			<span class="base-count">{entries1.length} מספרים</span>
		</div>

		<div class="panel">
			<h2 class="panel-title">הוסף מספר לבסיס 1</h2>
			<form
				method="POST"
				action="?/add1"
				use:enhance={() => {
					adding1 = true;
					return async ({ update }) => { adding1 = false; await update(); };
				}}
			>
				<div class="add-row">
					<input name="name" type="text" placeholder="שם (אופציונלי)" maxlength="60" class="input-name" />
					<input name="phone" type="tel" inputmode="numeric" placeholder="05XXXXXXXX" maxlength="15" required dir="ltr" />
					<button type="submit" class="btn-add" disabled={adding1}>{adding1 ? '...' : 'הוסף'}</button>
				</div>
			</form>
		</div>

		<div class="panel">
			<h2 class="panel-title">מספרים מורשים – בסיס 1 ({entries1.length})</h2>
			{#if entries1.length === 0}
				<p class="empty-note">אין מספרים בבסיס 1 עדיין</p>
			{:else}
				<ul class="number-list">
					{#each entries1 as e (e.phone)}
						<li class="number-item">
							<div class="entry-info">
								{#if e.name}<span class="entry-name">{e.name}</span>{/if}
								<span class="number" dir="ltr">{e.phone}</span>
							</div>
							<form method="POST" action="?/remove1" use:enhance={() => {
								removing = e.phone;
								return async ({ update }) => { removing = ''; await update(); };
							}}>
								<input type="hidden" name="phone" value={e.phone} />
								<button type="submit" class="btn-remove" disabled={removing === e.phone}>
									{removing === e.phone ? '...' : 'הסר'}
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- ── Base 2 ── -->
		<div class="base-header base2">
			<span class="base-badge">בסיס 2</span>
			<span class="base-count">{entries2.length} מספרים</span>
		</div>

		<div class="panel">
			<h2 class="panel-title">הוסף מספר לבסיס 2</h2>
			<form
				method="POST"
				action="?/add2"
				use:enhance={() => {
					adding2 = true;
					return async ({ update }) => { adding2 = false; await update(); };
				}}
			>
				<div class="add-row">
					<input name="name" type="text" placeholder="שם (אופציונלי)" maxlength="60" class="input-name" />
					<input name="phone" type="tel" inputmode="numeric" placeholder="05XXXXXXXX" maxlength="15" required dir="ltr" />
					<button type="submit" class="btn-add btn-add-2" disabled={adding2}>{adding2 ? '...' : 'הוסף'}</button>
				</div>
			</form>
		</div>

		<div class="panel">
			<h2 class="panel-title">מספרים מורשים – בסיס 2 ({entries2.length})</h2>
			{#if entries2.length === 0}
				<p class="empty-note">אין מספרים בבסיס 2 עדיין</p>
			{:else}
				<ul class="number-list">
					{#each entries2 as e (e.phone)}
						<li class="number-item">
							<div class="entry-info">
								{#if e.name}<span class="entry-name">{e.name}</span>{/if}
								<span class="number" dir="ltr">{e.phone}</span>
							</div>
							<form method="POST" action="?/remove2" use:enhance={() => {
								removing = e.phone;
								return async ({ update }) => { removing = ''; await update(); };
							}}>
								<input type="hidden" name="phone" value={e.phone} />
								<button type="submit" class="btn-remove" disabled={removing === e.phone}>
									{removing === e.phone ? '...' : 'הסר'}
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	.page {
		width: 100%;
		min-height: 100vh;
		background: #f1f5f9;
		padding: 20px 16px 60px;
		box-sizing: border-box;
	}
	.container {
		max-width: 480px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.top-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.logo {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 20px;
	}
	.logo span { font-size: 28px; }
	.logo h1 { font-size: 18px; font-weight: 700; color: #0f172a; }
	.btn-back {
		font-size: 13px;
		color: #64748b;
		text-decoration: none;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 6px 12px;
		white-space: nowrap;
	}
	.btn-back:hover { background: #f8fafc; }

	.base-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 2px 0;
	}
	.base-badge {
		font-size: 12px;
		font-weight: 800;
		border-radius: 20px;
		padding: 3px 12px;
		letter-spacing: 0.3px;
	}
	.base1 .base-badge { background: #dbeafe; color: #1d4ed8; }
	.base2 .base-badge { background: #ede9fe; color: #6d28d9; }
	.admin-row .base-badge { background: #fef3c7; color: #92400e; }
	.base-count { font-size: 12px; color: #94a3b8; font-weight: 600; }

	.panel {
		background: #fff;
		border-radius: 14px;
		border: 1px solid #e8edf3;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.panel-title {
		font-size: 14px;
		font-weight: 700;
		color: #475569;
	}
	.add-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}
	.input-name {
		flex: 1;
		min-width: 120px;
		max-width: 180px;
	}
	input {
		flex: 1;
		height: 42px;
		border: 1.5px solid #e2e8f0;
		border-radius: 10px;
		padding: 0 12px;
		font-size: 16px;
		outline: none;
		background: #f8fafc;
		color: #0f172a;
		transition: border-color 0.2s;
	}
	input:focus { border-color: #2563eb; }
	.btn-add {
		height: 42px;
		padding: 0 18px;
		background: #2563eb;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-add:hover:not(:disabled) { background: #1d4ed8; }
	.btn-add:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-add-2 { background: #7c3aed; }
	.btn-add-2:hover:not(:disabled) { background: #6d28d9; }

	.error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 13px;
	}

	.empty-note {
		font-size: 13px;
		color: #94a3b8;
		text-align: center;
		padding: 8px 0;
	}

	.number-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid #f1f5f9;
	}
	.number-item:last-child { border-bottom: none; }
	.entry-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.entry-name {
		font-size: 13px;
		font-weight: 700;
		color: #1e293b;
	}
	.number {
		font-family: 'Courier New', monospace;
		font-size: 13px;
		font-weight: 600;
		color: #64748b;
	}
	.btn-remove {
		font-size: 12px;
		font-weight: 600;
		color: #dc2626;
		background: #fef2f2;
		border: none;
		border-radius: 8px;
		padding: 4px 12px;
		cursor: pointer;
		transition: background 0.15s;
		flex-shrink: 0;
	}
	.btn-remove:hover:not(:disabled) { background: #fee2e2; }
	.btn-remove:disabled { opacity: 0.6; cursor: not-allowed; }

	.number-list {
		list-style: none;
		display: flex;
		flex-direction: column;
	}
</style>
