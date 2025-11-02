import * as fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import path from "node:path";

import parentLogger from "./logging.js";
import { SpinnerTransport } from "./spinner.js";
import { ensureExists, fallibleToNull, humanReadableSize } from "./util.js";
import { fetchWithLogs } from "./github.js";

import isInteractive from "is-interactive";
import ora from "ora";

const logger = parentLogger.child({ scope: "download" });

export type Downloader = (url: string, dest: string, _size?: number) => Promise<void>;
export const DownloadProvider: Record<"Actions" | "TrackedDownload", Downloader> = {
	TrackedDownload: downloadWithProgress,
	Actions: async (url: string, dest: string, _size?: number) => {
		try {
			const { downloadTool } = await import("@actions/tool-cache");
			await downloadTool(url, dest);
		} catch (err) {
			throw new Error(`Download failed (outside actions environment?): {$err}`);
		}
	}
};

async function downloadWithProgress(url: string, dest: string, size?: number): Promise<void> {
	const bar = createProgressBar();

	const fetch = fetchWithLogs("info");
	let abortController: AbortController | null = null;

	const startTime = Date.now();
	let cleanupInProgress = false;

	// to cleanup partial file and progress bar
	const cleanup = async (reason: string): Promise<void> => {
		if (cleanupInProgress) return;
		cleanupInProgress = true;

		// force abort
		if (abortController) {
			abortController.abort();
		}

		bar.fail(reason);

		fallibleToNull(async () => {
			// if this fails, the file might not have been downloaded yet
			await fs.promises.unlink(dest);
			logger.debug("Cleaning up partial download file");
		});
	};

	const handleInterruption = async (signal: string): Promise<void> => {
		await cleanup(`Download interrupted by ${signal}`);
		process.exit(1);
	};

	process.on("SIGINT", () => handleInterruption("SIGINT"));
	process.on("SIGTERM", () => handleInterruption("SIGTERM"));

	logger.debug(`Saving to: ${dest}`);

	try {
		abortController = new AbortController();
		const response = await fetch(url, { signal: abortController.signal });

		if (!response.ok) {
			bar.fail(`Download failed: ${response.status} ${response.statusText}`);
			throw new Error("Download failed");
		}

		const totalSize = size ?? parseInt(response.headers.get("content-length") || "0", 10);

		if (totalSize == 0) {
			logger.warn("Unknown file size, progress cannot be displayed");
			bar.setText("Downloading...");
		} else {
			logger.info(`File size: ${humanReadableSize(totalSize)}`);
		}

		if (!response.body) {
			logger.error("No response body returned!");
			throw new Error("Download failed");
		}

		ensureExists(path.dirname(dest));
		const responseStream = Readable.fromWeb(response.body as any);
		const fileStream = fs.createWriteStream(dest);

		let lastUpdate = Date.now();
		let downloadedSize = 0;

		// increment progress for data chunks
		responseStream.on("data", (chunk: Buffer) => {
			downloadedSize += chunk.length;

			// progress reports only sent 100ms for perf
			const now = Date.now();
			if (totalSize && (now - lastUpdate > 100 || downloadedSize === totalSize)) {
				lastUpdate = now;
				bar.update(downloadedSize, totalSize, now - startTime);
			}
		});

		// pipe data directly from network to fs, doesn't read into memory
		await pipeline(responseStream, fileStream);

		const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
		const avgDownloadSpeed = totalSize ? humanReadableSize(totalSize / parseFloat(totalTime)) + "/s" : "N/A";
		bar.success(`Download completed in ${totalTime}s (avg: ${avgDownloadSpeed})`);
		logger.info(`Download completed successfully in ${totalTime}s`);
	} catch (err) {
		const error = err as Error;

		bar.fail(`Download failed: ${error.message}`);

		// request aborted
		if (error.name === "AbortError") await cleanup("Download aborted");

		// misc errors
		await cleanup(error.message);
	} finally {
		// remove any signal handlers
		process.removeAllListeners("SIGINT");
		process.removeAllListeners("SIGTERM");
	}
}

function createProgressBar(barWidth: number = 30) {
	const interactive = isInteractive();

	const spinnerTransport = logger.transports[0] as SpinnerTransport; // fixme: a bit too fragile
	const bar = spinnerTransport
		.setSpinner(
			ora({
				color: "cyan",
				prefixText: "info:    ",
				isEnabled: interactive,
				spinner: {
					frames: [""]
				}
			})
		)
		.start();

	let lastLoggedPercent = 0;
	return {
		success: (message: string) => {
			bar.stop();
			logger.info(message);
		},

		fail: (message: string) => {
			bar.stop();
			logger.error(message);
		},

		setText: (text: string) => (bar.text = text),
		update: (downloadedSize: number, totalSize: number, msElapsed: number) => {
			const percent = Math.floor((downloadedSize / totalSize) * 100);
			const downloaded = humanReadableSize(downloadedSize);
			const total = humanReadableSize(totalSize);
			const secsElapsed = (msElapsed / 1000).toFixed(1);
			const speed = humanReadableSize(downloadedSize / (parseFloat(secsElapsed) || 1)) + "/s";

			if (!interactive) {
				// if not interactive, only log milestones (25%, 50%, 75%)
				if (percent >= lastLoggedPercent + 25 && percent < 100) {
					logger.info(`Progress: ${percent}% (${downloaded}/${total}, ${speed})`);
					lastLoggedPercent = percent;
				}
			} else {
				// display progress bar if interactive
				const filled = Math.floor((percent / 100) * barWidth);
				const empty = barWidth - filled;
				const text = "█".repeat(filled) + "░".repeat(empty);
				const progressBar = `[${text}]`;

				bar.text = `${progressBar} ${percent}% | ${downloaded}/${total} | ${speed} | ${secsElapsed}s`;
			}
		}
	};
}
