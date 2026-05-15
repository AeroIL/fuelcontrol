<script lang="ts">
	import { onDestroy, createEventDispatcher } from 'svelte';
	import { BrowserMultiFormatReader } from '@zxing/library';

	const dispatch = createEventDispatcher<{ scan: string }>();

	let videoEl: HTMLVideoElement;
	let reader: BrowserMultiFormatReader | null = null;

	let cameraError = '';
	let cameraActive = false;
	let lastResult = '';
	// 'environment' = back camera, 'user' = front camera
	let preferBack = true;

	async function startCamera() {
		cameraError = '';
		reader = new BrowserMultiFormatReader();

		try {
			// List available video input devices via Web API
			const allDevices = await navigator.mediaDevices.enumerateDevices();
			const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');

			let deviceId: string | undefined;
			if (preferBack) {
				const back = videoDevices.find((d: MediaDeviceInfo) =>
					/back|rear|environment/i.test(d.label)
				);
				deviceId = back?.deviceId ?? videoDevices[0]?.deviceId;
			} else {
				const front = videoDevices.find((d: MediaDeviceInfo) =>
					/front|user|selfie/i.test(d.label)
				);
				deviceId = front?.deviceId ?? videoDevices[0]?.deviceId;
			}

			cameraActive = true;

			// decodeFromVideoDevice streams to videoEl and calls cb on each decode
			await reader.decodeFromVideoDevice(
				deviceId ?? null,
				videoEl,
				(result) => {
					if (!result) return;
					const text = result.getText();
					if (!text || text === lastResult) return;
					lastResult = text;
					const digits = text.replace(/\D/g, '');
					if (digits.length >= 5) {
						dispatch('scan', digits);
					}
				}
			);
		} catch (e: unknown) {
			const err = e as Error;
			cameraActive = false;
			if (err.name === 'NotAllowedError') {
				cameraError = 'הגישה למצלמה נדחתה. אנא אשר גישה בהגדרות הדפדפן.';
			} else if (err.name === 'NotFoundError') {
				cameraError = 'לא נמצאה מצלמה במכשיר זה.';
			} else {
				cameraError = 'שגיאה בפתיחת המצלמה.';
				console.error(err);
			}
		}
	}

	function stopCamera() {
		reader?.reset();
		reader = null;
		cameraActive = false;
		lastResult = '';
	}

	async function flipCamera() {
		stopCamera();
		preferBack = !preferBack;
		await startCamera();
	}

	onDestroy(() => {
		stopCamera();
	});
</script>

<div class="scanner-wrapper">
	{#if !cameraActive}
		<div class="camera-placeholder">
			<div class="camera-icon">📷</div>
			<p>לחץ להפעלת המצלמה לסריקת ברקוד</p>
			<button class="btn-primary" on:click={startCamera}>הפעל מצלמה</button>
			{#if cameraError}
				<p class="error-text">{cameraError}</p>
			{/if}
		</div>
	{:else}
		<div class="camera-view">
			<!-- ZXing controls the video element directly -->
			<video bind:this={videoEl} class="video-feed" playsinline muted></video>

			<div class="scan-overlay">
				<div class="scan-frame"></div>
				<p class="scan-hint">כוון את הברקוד של הכרטיס אל תוך המסגרת</p>
			</div>

			<div class="camera-controls">
				<button class="btn-icon" on:click={flipCamera} title="הפוך מצלמה">🔄</button>
				<button class="btn-secondary" on:click={stopCamera}>סגור מצלמה</button>
			</div>
		</div>
	{/if}

	<!-- Always bind videoEl so ZXing can reference it -->
	{#if !cameraActive}
		<video bind:this={videoEl} class="video-feed hidden" playsinline muted></video>
	{/if}
</div>

<style>
	.scanner-wrapper {
		width: 100%;
		border-radius: var(--radius);
		overflow: hidden;
		background: #111;
	}

	.camera-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 32px 16px;
		background: #1a1a2e;
		color: #fff;
		min-height: 200px;
	}

	.camera-icon {
		font-size: 48px;
	}

	.camera-placeholder p {
		color: #a0aec0;
		font-size: 14px;
		text-align: center;
	}

	.camera-view {
		position: relative;
		width: 100%;
		background: #000;
	}

	.video-feed {
		width: 100%;
		display: block;
		max-height: 320px;
		object-fit: cover;
	}

	.video-feed.hidden {
		display: none;
	}

	.scan-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.scan-frame {
		width: 200px;
		height: 80px;
		border: 2px solid rgba(255, 255, 255, 0.8);
		border-radius: 6px;
		box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
	}

	.scan-hint {
		color: rgba(255, 255, 255, 0.85);
		font-size: 12px;
		margin-top: 8px;
		text-align: center;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
	}

	.camera-controls {
		position: absolute;
		bottom: 10px;
		left: 10px;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.btn-primary {
		background: var(--primary);
		color: #fff;
		padding: 10px 24px;
		border-radius: 8px;
		font-size: 15px;
		transition: background 0.2s;
	}

	.btn-primary:hover {
		background: var(--primary-dark);
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
		padding: 6px 14px;
		border-radius: 6px;
		font-size: 13px;
		backdrop-filter: blur(4px);
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.btn-icon {
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
		width: 36px;
		height: 36px;
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
	}
</style>
