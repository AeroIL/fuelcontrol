<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	export let form: ActionData;

	// Cast once in script so templates don't need `as any`
	$: f = form as { step?: string; phone?: string; error?: string } | null;

	let step: 'phone' | 'otp' = f?.step === 'otp' ? 'otp' : 'phone';
	let phone: string = f?.phone ?? '';
	let loading = false;

	function onSendResult(result: any) {
		loading = false;
		if (result?.type === 'success' && result?.data?.step === 'otp') {
			step = 'otp';
			phone = result.data.phone;
		}
	}
</script>

<svelte:head>
	<title>כניסה – ניהול כרטיסי דלק</title>
</svelte:head>

<div class="page">
	<div class="card">
		<div class="logo">
			<span class="logo-emoji">⛽</span>
			<h1>ניהול כרטיסי דלק</h1>
			<p class="sub">Goodi Fuel Control</p>
		</div>

		{#if step === 'phone'}
			<form
				method="POST"
				action="?/sendOtp"
				use:enhance={() => {
					loading = true;
					return async ({ result, update }) => {
						await update({ reset: false });
						onSendResult(result);
					};
				}}
			>
				<div class="field">
					<label for="phone">מספר טלפון</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						inputmode="numeric"
						placeholder="05XXXXXXXX"
						bind:value={phone}
						required
						autocomplete="tel"
						dir="ltr"
						maxlength="15"
					/>
				</div>

				{#if f?.error && f?.step === 'phone'}
					<p class="error" role="alert">{f.error}</p>
				{/if}

				<button type="submit" class="btn-primary" disabled={loading}>
					{#if loading}
						<span class="spinner"></span>
					{:else}
						שלח קוד SMS
					{/if}
				</button>
			</form>
		{:else}
			<p class="sent-note">קוד נשלח ל‑<strong dir="ltr">{phone}</strong></p>

			<form
				method="POST"
				action="?/verifyOtp"
				use:enhance={() => {
					loading = true;
					return async ({ result, update }) => {
						loading = false;
						await update({ reset: false });
					};
				}}
			>
				<input type="hidden" name="phone" value={phone} />

				<div class="field">
					<label for="otp">קוד אימות (6 ספרות)</label>
					<input
						id="otp"
						name="otp"
						type="text"
						inputmode="numeric"
						placeholder="——————"
						maxlength="6"
						required
						autocomplete="one-time-code"
						dir="ltr"
						class="otp-input"
					/>
				</div>

				{#if f?.error && f?.step === 'otp'}
					<p class="error" role="alert">{f.error}</p>
				{/if}

				<button type="submit" class="btn-primary" disabled={loading}>
					{#if loading}
						<span class="spinner"></span>
					{:else}
						כניסה
					{/if}
				</button>

				<button
					type="button"
					class="btn-ghost"
					on:click={() => { step = 'phone'; loading = false; }}
				>
					שנה מספר
				</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f1f5f9;
		padding: 20px;
	}

	.card {
		background: #fff;
		border-radius: 20px;
		border: 1px solid #e8edf3;
		padding: 36px 32px;
		width: 100%;
		max-width: 380px;
		display: flex;
		flex-direction: column;
		gap: 24px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
	}

	.logo {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.logo-emoji { font-size: 48px; }
	.logo h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
	.logo .sub { font-size: 12px; color: #94a3b8; }

	form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	label {
		font-size: 13px;
		font-weight: 600;
		color: #475569;
	}
	input {
		height: 48px;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		padding: 0 14px;
		font-size: 16px;
		outline: none;
		color: #0f172a;
		transition: border-color 0.2s, box-shadow 0.2s;
		background: #f8fafc;
		width: 100%;
	}
	input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
		background: #fff;
	}

	.otp-input {
		letter-spacing: 0.5em;
		font-size: 24px;
		text-align: center;
		font-weight: 700;
	}

	.btn-primary {
		height: 48px;
		background: #2563eb;
		color: #fff;
		border-radius: 12px;
		font-size: 16px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
		border: none;
		cursor: pointer;
	}
	.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

	.btn-ghost {
		height: 40px;
		background: none;
		color: #64748b;
		border: none;
		font-size: 14px;
		cursor: pointer;
		text-align: center;
	}
	.btn-ghost:hover { color: #1e293b; }

	.error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		border-radius: 8px;
		padding: 8px 12px;
		font-size: 13px;
	}

	.sent-note {
		font-size: 13px;
		color: #475569;
		text-align: center;
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 8px;
		padding: 8px 12px;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid rgba(255, 255, 255, 0.35);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 420px) {
		.card { padding: 28px 20px; }
	}
</style>
