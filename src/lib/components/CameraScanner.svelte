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


	const dispatch = createEventDispatcher<{ scan: string }>();

	let videoEl: HTMLVideoElement;
	let reader: BrowserMultiFormatReader | null = null;

	let cameraError = '';
	let cameraActive = false;
	let lastResult = '';
	let preferBack = true;

	async function startCamera() {
		cameraError = '';

		if (!navigator?.mediaDevices?.getUserMedia) {
			cameraError = 'הדפדפן אינו תומך בגישה למצלמה. נסה Chrome/Safari עדכני.';
			return;
		}

		cameraActive = true;
		// Wait for Svelte to show the video element before ZXing touches it
		await tick();

		const constraints: MediaStreamConstraints = {
			video: preferBack
				? { facingMode: { ideal: 'environment' } }
				: { facingMode: 'user' }
		};

		try {
			reader = new BrowserMultiFormatReader();
			await reader.decodeFromConstraints(constraints, videoEl, (result) => {
				if (!result) return;
				const text = result.getText();
				if (!text || text === lastResult) return;
				lastResult = text;
				const digits = text.replace(/\D/g, '');
				if (digits.length >= 5) dispatch('scan', digits);
			});
		} catch (e: unknown) {
			const err = e as Error;
			cameraActive = false;
			if (err.name === 'NotAllowedError') {
				cameraError = 'הגישה למצלמה נדחתה. אנא אשר גישה בהגדרות הדפדפן.';
			} else if (err.name === 'NotFoundError') {
				cameraError = 'לא נמצאה מצלמה במכשיר זה.';
			} else if (err.name === 'NotReadableError') {
				cameraError = 'המצלמה בשימוש על ידי אפליקציה אחרת.';
			} else {
				cameraError = `שגיאה: ${err.message || 'לא ניתן לפתוח מצלמה'}`;
				console.error(err);
			}
		}
	}

	function stopCamera() {
		reader?.reset();
		reader = null;
		// Also stop any tracks still attached to the video element
		if (videoEl?.srcObject) {
			(videoEl.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
			videoEl.srcObject = null;
		}
		cameraActive = false;
		lastResult = '';
	}

	async function flipCamera() {
		stopCamera();
		preferBack = !preferBack;
		await startCamera();
	}

	onDestroy(() => stopCamera());
</script>

<!-- Single video element always in DOM so videoEl never gets rebound -->
<div class="scanner-wrapper">
	<video
		bind:this={videoEl}
		class="video-feed"
		class:hidden={!cameraActive}
		playsinline
		muted
	></video>

	{#if !cameraActive}
		<div class="camera-placeholder">
			<div class="camera-icon">�</div>
			<p class="ph-title">סרוק כרטיס דלק</p>
			<p class="ph-sub">כוון את מספר הכרטיס מול המצלמה</p>
			<button class="btn-primary" on:click={startCamera}>הפעל מצלמה</button>
			{#if cameraError}
				<p class="error-text">{cameraError}</p>
			{/if}
		</div>
	{:else}
		<!-- dark overlay with a card-shaped cutout in the centre -->
		<div class="overlay" aria-hidden="true">
			<!-- top dark band -->
			<div class="band top"></div>
			<!-- middle row: side bands + transparent card window -->
			<div class="middle-row">
				<div class="band side"></div>
				<div class="card-window">
					<!-- card outline corners -->
					<span class="corner tl"></span>
					<span class="corner tr"></span>
					<span class="corner bl"></span>
					<span class="corner br"></span>
				<!-- number zone: LEFT vertical strip (number is rotated on left edge) -->
				<div class="num-zone">
					<div class="num-box">
						<div class="scan-line"></div>
					</div>
					<p class="num-label">מספר כרטיס</p>
					</div>
				</div>
				<div class="band side"></div>
			</div>
			<!-- bottom dark band -->
			<div class="band bottom">
				<p class="hint">כוון את הכרטיס כך שימלא את המסגרת הלבנה<br>המספר המודפס בצד שמאל יוצג בתיבה הירוקה</p>
			</div>
		</div>

		<div class="camera-controls">
			<button class="btn-icon" on:click={flipCamera} title="הפוך מצלמה">🔄</button>
			<button class="btn-secondary" on:click={stopCamera}>סגור</button>
		</div>
	{/if}
</div>

<style>
	/* ── wrapper ── */
	.scanner-wrapper {
		width: 100%;
		border-radius: var(--radius, 14px);
		overflow: hidden;
		background: #000;
		position: relative;
	}

	/* ── live video ── */
	.video-feed {
		width: 100%;
		display: block;
		height: 380px;
		object-fit: cover;
	}
	.video-feed.hidden { display: none; }

	/* ── idle placeholder ── */
	.camera-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 36px 20px;
		background: #0f172a;
		color: #fff;
		min-height: 220px;
	}
	.camera-icon { font-size: 52px; }
	.ph-title { font-size: 16px; font-weight: 700; color: #f1f5f9; }
	.ph-sub   { font-size: 13px; color: #94a3b8; text-align: center; }

	/* ── full-screen overlay (sits over the video) ── */
	.overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		pointer-events: none;
	}

	/* dark bands that surround the card window */
	.band { background: rgba(0,0,0,0.55); }
	.band.top    { flex: 1; }
	.band.bottom {
		flex: 1.2;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 10px;
	}
	.band.side   { flex: 1; }

	.middle-row {
		display: flex;
		/* card aspect ratio 85.6 × 54 mm  ≈  1.585:1  →  use 80 % width */
		height: calc(80vw / 1.585);
		max-height: 190px;
	}

	/* ── transparent card window ── */
	.card-window {
		/* width is whatever is left between the two side bands */
		flex: 5;
		position: relative;
		border: 2px solid rgba(255,255,255,0.9);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* corner accents */
	.corner {
		position: absolute;
		width: 18px; height: 18px;
		border-color: #fff;
		border-style: solid;
		border-width: 0;
	}
	.corner.tl { top: -2px;    left: -2px;    border-top-width: 3px; border-left-width: 3px;  border-top-left-radius: 10px; }
	.corner.tr { top: -2px;    right: -2px;   border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 10px; }
	.corner.bl { bottom: -2px; left: -2px;    border-bottom-width: 3px; border-left-width: 3px;  border-bottom-left-radius: 10px; }
	.corner.br { bottom: -2px; right: -2px;   border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 10px; }

	/* ── number zone: left vertical strip ── */
	.num-zone {
		position: absolute;
		top: 10px;
		bottom: 10px;
		left: 10px;   /* left edge — that's where the rotated number is */
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
	}

	.num-box {
		width: 30px;       /* narrow vertical strip */
		flex: 1;
		border: 2px solid rgba(74,222,128,0.95);
		border-radius: 4px;
		background: rgba(74,222,128,0.08);
		position: relative;
		overflow: hidden;
	}

	/* scan line sweeps top→bottom */
	.scan-line {
		position: absolute;
		left: 0; right: 0;
		height: 2px;
		background: rgba(74,222,128,0.9);
		animation: sweep 1.6s ease-in-out infinite;
		box-shadow: 0 0 6px rgba(74,222,128,0.8);
	}
	@keyframes sweep {
		0%   { top: 0; }
		50%  { top: calc(100% - 2px); }
		100% { top: 0; }
	}

	.num-label {
		font-size: 9px;
		color: rgba(74,222,128,0.95);
		letter-spacing: 0.4px;
		text-shadow: 0 1px 3px rgba(0,0,0,0.9);
		white-space: nowrap;
		writing-mode: vertical-rl;  /* label also vertical to match the number */
		text-orientation: mixed;
	}

	/* hint text in bottom band */
	.hint {
		font-size: 12px;
		color: rgba(255,255,255,0.8);
		text-align: center;
		text-shadow: 0 1px 2px rgba(0,0,0,0.8);
		padding: 0 12px;
		line-height: 1.4;
	}

	/* ── controls ── */
	.camera-controls {
		position: absolute;
		top: 10px;
		left: 10px;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.btn-primary {
		background: var(--primary, #1d4ed8);
		color: #fff;
		padding: 10px 28px;
		border-radius: 8px;
		font-size: 15px;
		font-weight: 600;
		transition: opacity 0.2s;
	}
	.btn-primary:hover { opacity: 0.88; }

	.btn-secondary {
		background: rgba(255,255,255,0.15);
		color: #fff;
		padding: 6px 14px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 600;
		backdrop-filter: blur(4px);
	}
	.btn-secondary:hover { background: rgba(255,255,255,0.28); }

	.btn-icon {
		background: rgba(255,255,255,0.15);
		color: #fff;
		width: 36px; height: 36px;
		border-radius: 50%;
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(4px);
	}

	.error-text {
		color: #fc8181;
		font-size: 13px;
		text-align: center;
		max-width: 260px;
	}
</style>
