<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher<{ scan: string }>();

	let fileInput: HTMLInputElement;
	let previewUrl = '';
	let state: 'idle' | 'processing' | 'results' | 'error' = 'idle';
	let candidates: string[] = [];
	let errorMsg = '';
	let progress = 0;
	let statusText = '';

	function reset() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = '';
		state = 'idle';
		candidates = [];
		errorMsg = '';
		progress = 0;
		statusText = '';
		if (fileInput) fileInput.value = '';
	}

	function rotateBlob(blob: Blob, deg: number): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(blob);
			img.onload = () => {
				URL.revokeObjectURL(url);
				const rad = (deg * Math.PI) / 180;
				const sin = Math.abs(Math.sin(rad));
				const cos = Math.abs(Math.cos(rad));
				const canvas = document.createElement('canvas');
				canvas.width = img.height * sin + img.width * cos;
				canvas.height = img.height * cos + img.width * sin;
				const ctx = canvas.getContext('2d')!;
				ctx.translate(canvas.width / 2, canvas.height / 2);
				ctx.rotate(rad);
				ctx.drawImage(img, -img.width / 2, -img.height / 2);
				canvas.toBlob(
					(b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
					'image/jpeg',
					0.92
				);
			};
			img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
			img.src = url;
		});
	}

	async function runOcr(blob: Blob): Promise<string[]> {
		// Dynamic import so it never runs on server
		const { createWorker } = await import('tesseract.js');
		const worker = await createWorker('eng', 1, {
			logger: (m: { status: string; progress: number }) => {
				if (m.status === 'recognizing text') {
					progress = Math.round(m.progress * 100);
				}
			}
		});
		await worker.setParameters({
			// digits only, sparse layout (finds text anywhere in image)
			tessedit_char_whitelist: '0123456789',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			tessedit_pageseg_mode: '11' as any
		});
		const { data: { text } } = await worker.recognize(blob);
		await worker.terminate();
		// Return unique sequences of 7-12 digits
		return [...new Set([...text.matchAll(/\d{7,12}/g)].map((m) => m[0]))];
	}

	async function handleFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		previewUrl = URL.createObjectURL(file);
		state = 'processing';
		candidates = [];
		errorMsg = '';
		progress = 0;

		try {
			// Try 1: original orientation
			statusText = 'מנסה זיהוי...';
			let found = await runOcr(file);

			// Try 2: 90° CW — number is printed vertically on the card
			if (found.length === 0) {
				statusText = 'מנסה עם סיבוב...';
				progress = 0;
				found = await runOcr(await rotateBlob(file, 90));
			}

			// Try 3: 90° CCW
			if (found.length === 0) {
				statusText = 'מנסה סיבוב שני...';
				progress = 0;
				found = await runOcr(await rotateBlob(file, -90));
			}

			if (found.length === 0) {
				state = 'error';
				errorMsg = 'לא זוהה מספר. ודא תאורה טובה, הכרטיס ישר ומלא את הפריים, ונסה שוב.';
			} else if (found.length === 1) {
				reset();
				dispatch('scan', found[0]);
			} else {
				candidates = found;
				state = 'results';
			}
		} catch (err) {
			console.error(err);
			state = 'error';
			errorMsg = 'שגיאה בעיבוד התמונה. נסה שוב.';
		}
	}

	function pick(num: string) {
		reset();
		dispatch('scan', num);
	}
</script>

<!-- hidden file input — capture="environment" opens rear camera on mobile -->
<input
	bind:this={fileInput}
	type="file"
	accept="image/*"
	capture="environment"
	class="file-input"
	on:change={handleFile}
/>

<div class="scanner">
	{#if state === 'idle'}
		<div class="panel">
			<span class="big-icon">💳</span>
			<p class="title">סרוק כרטיס דלק</p>
			<p class="sub">צלם את הכרטיס — המספר יזוהה אוטומטית</p>
			<p class="tip">💡 כוון את הצד השמאלי של הכרטיס (עם המספר) לכיוון המצלמה</p>
			<button class="btn-primary" on:click={() => fileInput.click()}>
				📷 צלם / בחר תמונה
			</button>
		</div>

	{:else if state === 'processing'}
		<div class="panel no-pad">
			<img src={previewUrl} alt="" class="preview" />
			<div class="progress-box">
				<div class="spinner"></div>
				<span class="status">{statusText}{progress > 0 ? ` ${progress}%` : ''}</span>
				<div class="bar-track"><div class="bar-fill" style="width:{progress}%"></div></div>
			</div>
		</div>

	{:else if state === 'results'}
		<div class="panel no-pad">
			<img src={previewUrl} alt="" class="preview" />
			<div class="results-body">
				<p class="pick-title">נמצאו מספרים — בחר את הנכון:</p>
				<div class="candidates">
					{#each candidates as num}
						<button class="candidate-btn" on:click={() => pick(num)} dir="ltr">{num}</button>
					{/each}
				</div>
				<button class="btn-ghost" on:click={() => fileInput.click()}>📷 צלם שוב</button>
				<button class="btn-ghost dim" on:click={reset}>ביטול</button>
			</div>
		</div>

	{:else if state === 'error'}
		<div class="panel no-pad">
			{#if previewUrl}
				<img src={previewUrl} alt="" class="preview dimmed" />
			{/if}
			<div class="results-body">
				<p class="err-msg">⚠️ {errorMsg}</p>
				<button class="btn-primary" on:click={() => fileInput.click()}>📷 נסה שוב</button>
				<button class="btn-ghost dim" on:click={reset}>ביטול</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.file-input { display: none; }

	.scanner {
		width: 100%;
		border-radius: var(--radius, 14px);
		overflow: hidden;
		background: #0f172a;
		color: #f1f5f9;
	}

	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 32px 20px;
	}
	.panel.no-pad { gap: 0; padding: 0; }

	.big-icon { font-size: 52px; }
	.title { font-size: 17px; font-weight: 700; }
	.sub {
		font-size: 13px; color: #94a3b8;
		text-align: center; max-width: 260px; line-height: 1.4;
	}
	.tip {
		font-size: 12px; color: #475569;
		text-align: center; max-width: 280px; line-height: 1.4;
		background: #1e293b; border-radius: 8px;
		padding: 8px 12px;
	}

	/* preview image */
	.preview {
		width: 100%; max-height: 260px;
		object-fit: cover; display: block;
	}
	.preview.dimmed { opacity: 0.4; }

	/* processing */
	.progress-box {
		width: 100%; background: #1e293b;
		padding: 14px 20px;
		display: flex; flex-direction: column;
		align-items: center; gap: 8px;
	}
	.spinner {
		width: 26px; height: 26px;
		border: 3px solid #334155;
		border-top-color: #3b82f6;
		border-radius: 50%;
		animation: spin 0.75s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
	.status { font-size: 13px; color: #cbd5e1; }
	.bar-track {
		width: 100%; height: 4px;
		background: #334155; border-radius: 99px; overflow: hidden;
	}
	.bar-fill {
		height: 100%; background: #3b82f6;
		border-radius: 99px; transition: width 0.25s ease;
	}

	/* results */
	.results-body {
		width: 100%; background: #1e293b;
		padding: 14px 16px;
		display: flex; flex-direction: column;
		align-items: center; gap: 10px;
	}
	.pick-title { font-size: 14px; font-weight: 600; color: #f1f5f9; }
	.candidates {
		display: flex; flex-wrap: wrap;
		gap: 8px; justify-content: center;
	}
	.candidate-btn {
		background: #1d4ed8; color: #fff;
		padding: 10px 22px; border-radius: 8px;
		font-size: 16px; font-weight: 700;
		font-family: 'Courier New', monospace;
		letter-spacing: 1.5px;
		transition: background 0.13s;
	}
	.candidate-btn:hover { background: #2563eb; }

	/* error */
	.err-msg {
		font-size: 13px; color: #fca5a5;
		text-align: center; line-height: 1.5;
		max-width: 300px;
	}

	/* buttons */
	.btn-primary {
		background: #1d4ed8; color: #fff;
		padding: 11px 28px; border-radius: 10px;
		font-size: 15px; font-weight: 600;
		transition: opacity 0.15s;
	}
	.btn-primary:hover { opacity: 0.88; }

	.btn-ghost {
		background: none; color: #64748b;
		font-size: 13px; padding: 4px 10px;
		border-radius: 6px;
		transition: color 0.13s;
	}
	.btn-ghost:hover { color: #f1f5f9; }
	.btn-ghost.dim { color: #334155; font-size: 12px; }
</style>