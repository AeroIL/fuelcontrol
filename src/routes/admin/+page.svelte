<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	export let data: PageData;
	export let form: ActionData;

	type Entry = { phone: string; name: string };
	type BaseConfig = { id: string; name: string };
	type AF = { bases?: BaseConfig[]; entries?: Record<string, Entry[]>; error?: string } | null;

	$: af = form as AF;
	$: bases = af?.bases ?? data.bases;
	$: entries = af?.entries ?? data.entries;

	let creatingBase = false;
	let addingTo: string | null = null;
	let removingPhone = '';
	let deletingBaseId: string | null = null;
</script>

<svelte:head>
	<title>ניהול בסיסים – Goodi</title>
</svelte:head>

<div class="page">
	<div class="container">
		<header class="top-bar">
			<div class="logo">
				<span>⛽</span>
				<h1>ניהול בסיסים והרשאות</h1>
			</div>
			<a href="/" class="btn-back">← חזרה</a>
		</header>

		{#if af?.error}
			<p class="error">{af.error}</p>
		{/if}

		<!-- Admin identity row -->
		<div class="admin-row">
			<span class="badge badge-admin">מנהל מערכת</span>
			<span class="admin-phone" dir="ltr">0524746673</span>
			<span class="admin-note">גישה לכל הבסיסים</span>
		</div>

		<!-- Create new base -->
		<div class="panel">
			<h2 class="panel-title">➕ הוסף בסיס חדש</h2>
			<form
				method="POST"
				action="?/createBase"
				use:enhance={() => {
					creatingBase = true;
					return async ({ update }) => {
						creatingBase = false;
						await update();
					};
				}}
			>
				<div class="add-row">
					<input name="name" type="text" placeholder='שם הבסיס, למשל: "בסיס צפון"' maxlength="60" required />
					<button type="submit" class="btn-create" disabled={creatingBase}>
						{creatingBase ? '...' : 'צור בסיס'}
					</button>
				</div>
			</form>
		</div>

		<!-- Dynamic bases -->
		{#each bases as base (base.id)}
			{@const baseEntries = entries[base.id] ?? []}
			<div class="base-section">
				<div class="base-header">
					<span class="badge badge-base">{base.name}</span>
					<span class="base-id"># {base.id}</span>
					<span class="base-count">{baseEntries.length} מספרים</span>
					<div class="spacer"></div>
					{#if deletingBaseId === base.id}
						<div class="confirm-row">
							<span class="confirm-text">מחק לצמיתות?</span>
							<form
								method="POST"
								action="?/deleteBase"
								use:enhance={() => {
									return async ({ update }) => {
										deletingBaseId = null;
										await update();
									};
								}}
							>
								<input type="hidden" name="id" value={base.id} />
								<button type="submit" class="btn-del-yes">מחק</button>
							</form>
							<button class="btn-del-no" on:click={() => (deletingBaseId = null)}>ביטול</button>
						</div>
					{:else}
						<button class="btn-delete-base" on:click={() => (deletingBaseId = base.id)}>
							מחק
						</button>
					{/if}
				</div>

				<div class="panel">
					<h2 class="panel-title">הוסף מספר ל{base.name}</h2>
					<form
						method="POST"
						action="?/addMember"
						use:enhance={() => {
							addingTo = base.id;
							return async ({ update }) => {
								addingTo = null;
								await update();
							};
						}}
					>
						<input type="hidden" name="baseId" value={base.id} />
						<div class="add-row">
							<input name="name" type="text" placeholder="שם (אופציונלי)" maxlength="60" class="input-name" />
							<input name="phone" type="tel" inputmode="numeric" placeholder="05XXXXXXXX" maxlength="15" required dir="ltr" />
							<button type="submit" class="btn-add" disabled={addingTo === base.id}>
								{addingTo === base.id ? '...' : 'הוסף'}
							</button>
						</div>
					</form>
				</div>

				{#if baseEntries.length > 0}
					<div class="panel">
						<h2 class="panel-title">מספרים מורשים ({baseEntries.length})</h2>
						<ul class="number-list">
							{#each baseEntries as e (e.phone)}
								<li class="number-item">
									<div class="entry-info">
										{#if e.name}<span class="entry-name">{e.name}</span>{/if}
										<span class="number" dir="ltr">{e.phone}</span>
									</div>
									<form
										method="POST"
										action="?/removeMember"
										use:enhance={() => {
											removingPhone = e.phone;
											return async ({ update }) => {
												removingPhone = '';
												await update();
											};
										}}
									>
										<input type="hidden" name="baseId" value={base.id} />
										<input type="hidden" name="phone" value={e.phone} />
										<button type="submit" class="btn-remove" disabled={removingPhone === e.phone}>
											{removingPhone === e.phone ? '...' : 'הסר'}
										</button>
									</form>
								</li>
							{/each}
						</ul>
					</div>
				{:else}
					<p class="empty-note">אין מספרים מורשים בבסיס זה עדיין</p>
				{/if}
			</div>
		{/each}

		{#if bases.length === 0}
			<div class="empty-state">
				<p>לא הוגדרו בסיסים עדיין. צור בסיס ראשון!</p>
			</div>
		{/if}
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

	/* Admin row */
	.admin-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 12px;
	}
	.badge {
		font-size: 12px;
		font-weight: 800;
		border-radius: 20px;
		padding: 3px 12px;
	}
	.badge-admin { background: #fef3c7; color: #92400e; }
	.badge-base { background: #dbeafe; color: #1d4ed8; }
	.admin-phone { font-family: monospace; font-size: 13px; color: #374151; }
	.admin-note { font-size: 12px; color: #92400e; }

	/* Base section */
	.base-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.base-header {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.base-id { font-size: 11px; color: #94a3b8; font-family: monospace; }
	.base-count { font-size: 12px; color: #94a3b8; font-weight: 600; }
	.spacer { flex: 1; }

	.confirm-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.confirm-text { font-size: 12px; color: #dc2626; font-weight: 600; }
	.btn-del-yes {
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		background: #dc2626;
		border: none;
		border-radius: 8px;
		padding: 4px 12px;
		cursor: pointer;
	}
	.btn-del-yes:hover { background: #b91c1c; }
	.btn-del-no {
		font-size: 12px;
		font-weight: 600;
		color: #64748b;
		background: #f1f5f9;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 4px 10px;
		cursor: pointer;
	}
	.btn-delete-base {
		font-size: 12px;
		font-weight: 600;
		color: #dc2626;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 4px 12px;
		cursor: pointer;
	}
	.btn-delete-base:hover { background: #fee2e2; }

	/* Panels */
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
		min-width: 100px;
		max-width: 160px;
	}
	input[type='text'],
	input[type='tel'] {
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
	.btn-create {
		height: 42px;
		padding: 0 20px;
		background: #059669;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-create:hover:not(:disabled) { background: #047857; }
	.btn-create:disabled { opacity: 0.6; cursor: not-allowed; }

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
		padding: 4px 0;
	}
	.empty-state {
		text-align: center;
		padding: 40px 20px;
		color: #94a3b8;
		font-size: 15px;
	}

	.number-list {
		list-style: none;
		display: flex;
		flex-direction: column;
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
</style>