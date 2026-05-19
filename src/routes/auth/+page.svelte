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

		<div class="step-dots">
			<div class="dot" class:active={step === 'phone'}></div>
			<div class="dot" class:active={step === 'otp'}></div>
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
						class="phone-input"
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
			<div class="sent-note">קוד נשלח ל‑<strong dir="ltr">{phone}</strong></div>

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
						placeholder="000000"
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
		width: 100%;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(150deg, #0f172a 0%, #1e3554 50%, #0f172a 100%);
		padding: 20px;
		box-sizing: border-box;
	}

	.card {
		background: #fff;
		border-radius: 24px;
		padding: 40px 36px;
		width: 100%;
		max-width: 390px;
		display: flex;
		flex-direction: column;
		gap: 26px;
		box-shadow: 0 24px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08);
	}

	/* Logo */
	.logo {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.logo-emoji {
		font-size: 52px;
		line-height: 1;
		filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
	}
	.logo h1 {
		font-size: 22px;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.5px;
	}
	.logo .sub {
		font-size: 11px;
		font-weight: 600;
		color: #94a3b8;
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	/* Step dots */
	.step-dots {
		display: flex;
		justify-content: center;
		gap: 6px;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #e2e8f0;
		transition: background 0.25s, transform 0.25s;
	}
	.dot.active {
		background: #2563eb;
		transform: scale(1.25);
	}

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
		font-size: 11px;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.6px;
	}
	input {
		height: 52px;
		border: 2px solid #e8edf3;
		border-radius: 14px;
		padding: 0 16px;
		font-size: 16px;
		outline: none;
		color: #0f172a;
		transition: border-color 0.2s, box-shadow 0.2s;
		background: #f8fafc;
		width: 100%;
	}
	input:focus {
		border-color: #2563eb;
		box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
		background: #fff;
	}

	.phone-input {
		text-align: left;
		letter-spacing: 0.1em;
		font-family: 'Courier New', monospace;
		font-size: 20px;
		font-weight: 600;
	}

	.otp-input {
		letter-spacing: 0.7em;
		font-size: 28px;
		text-align: center;
		font-weight: 800;
		padding: 0 10px;
	}

	.sent-note {
		text-align: center;
		font-size: 13px;
		color: #475569;
		background: #f0fdf4;
		border: 1.5px solid #bbf7d0;
		border-radius: 12px;
		padding: 11px 16px;
		font-weight: 500;
	}

	.btn-primary {
		height: 52px;
		background: linear-gradient(135deg, #2563eb, #1d4ed8);
		color: #fff;
		border-radius: 14px;
		font-size: 16px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.12s, box-shadow 0.15s;
		border: none;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
		letter-spacing: 0.2px;
	}
	.btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4);
	}
	.btn-primary:active:not(:disabled) { transform: translateY(0); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

	.btn-ghost {
		height: 46px;
		background: none;
		color: #64748b;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		text-align: center;
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.btn-ghost:hover { border-color: #94a3b8; color: #1e293b; background: #f8fafc; }

	.error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1.5px solid #fecaca;
		border-radius: 10px;
		padding: 10px 14px;
		font-size: 13px;
		font-weight: 500;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2.5px solid rgba(255, 255, 255, 0.35);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	@media (max-width: 420px) {
		.card { padding: 30px 20px; }
	}
</style>
