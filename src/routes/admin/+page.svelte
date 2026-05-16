<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	$: af = form as { numbers?: string[]; error?: string } | null;
	$: numbers = af?.numbers ?? data.numbers;
	let adding = false;
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

		<!-- Add number -->
		<div class="panel">
			<h2 class="panel-title">הוסף מספר לרשימה</h2>
			<form
				method="POST"
				action="?/add"
				use:enhance={() => {
					adding = true;
					return async ({ update }) => { adding = false; await update(); };
				}}
			>
				<div class="add-row">
					<input
						name="phone"
						type="tel"
						inputmode="numeric"
						placeholder="05XXXXXXXX"
						maxlength="15"
						required
						dir="ltr"
					/>
					<button type="submit" class="btn-add" disabled={adding}>
						{adding ? '...' : 'הוסף'}
					</button>
				</div>
			</form>
			{#if af?.error}
				<p class="error">{af.error}</p>
			{/if}
		</div>

		<!-- Whitelist -->
		<div class="panel">
			<h2 class="panel-title">מספרים מורשים ({numbers.length})</h2>
			<ul class="number-list">
				{#each numbers as n (n)}
					<li class="number-item">
						<span class="number" dir="ltr">{n}</span>
						{#if n === '0524746673'}
							<span class="admin-badge">מנהל</span>
						{:else}
							<form
								method="POST"
								action="?/remove"
								use:enhance={() => {
									removing = n;
									return async ({ update }) => { removing = ''; await update(); };
								}}
							>
								<input type="hidden" name="phone" value={n} />
								<button type="submit" class="btn-remove" disabled={removing === n}>
									{removing === n ? '...' : 'הסר'}
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
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
		gap: 20px;
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
		gap: 10px;
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

	.error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 13px;
	}

	.number-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.number-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #f8fafc;
		border-radius: 10px;
		padding: 10px 14px;
		gap: 8px;
	}
	.number {
		font-family: 'Courier New', monospace;
		font-size: 15px;
		font-weight: 600;
		color: #1e293b;
	}
	.admin-badge {
		font-size: 11px;
		font-weight: 700;
		background: #dbeafe;
		color: #1d4ed8;
		border-radius: 20px;
		padding: 2px 10px;
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
		white-space: nowrap;
	}
	.btn-remove:hover:not(:disabled) { background: #fee2e2; }
	.btn-remove:disabled { opacity: 0.5; }

	@media (max-width: 480px) {
		.logo h1 { font-size: 15px; }
	}
</style>
