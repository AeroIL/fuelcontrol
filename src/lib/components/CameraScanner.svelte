<script lang="ts">
	import { onDestroy, createEventDispatcher, tick } from 'svelte';
	import { BrowserMultiFormatReader } from '@zxing/library';

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
				<!-- number zone: bottom-left corner of the card -->
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
				<p class="hint">כוון את הכרטיס כך שימלא את המסגרת<br>המספר (פינה שמאל-תחתית) יוצג בתיבה הירוקה</p>
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

	/* ── number zone: bottom-LEFT corner of the card ── */
	.num-zone {
		position: absolute;
		bottom: 10px;
		left: 10px;   /* bottom-left to match the real card */
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}

	.num-box {
		width: 120px;
		height: 28px;
		border: 2px solid rgba(74,222,128,0.95);  /* green to stand out */
		border-radius: 4px;
		background: rgba(74,222,128,0.08);
		position: relative;
		overflow: hidden;
	}

	/* animated scan line */
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
		font-size: 10px;
		color: rgba(74,222,128,0.95);
		letter-spacing: 0.5px;
		text-shadow: 0 1px 3px rgba(0,0,0,0.9);
		white-space: nowrap;
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
