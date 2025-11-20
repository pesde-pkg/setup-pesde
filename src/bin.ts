// todo: CLI frontend

import { DownloadProvider } from "@/download.js";
import logger, { isDebug } from "@/logging/index.js";
import { ToolManager } from "@/tool.js";
import { humanReadableSize } from "@/util.js";

// monitor peak heap usage for debugging
let peakHeap = 0;
let monitorInterval: NodeJS.Timeout;
if (isDebug()) {
	monitorInterval = setInterval(() => {
		const { heapUsed } = process.memoryUsage();
		if (heapUsed > peakHeap) peakHeap = heapUsed;
	}, 500); // check every 500ms
}

const version = "0.7.1";
await new ToolManager("pesde-pkg", "pesde")
	.version((potential) => potential.match(/^v?(\d+\.\d+\.\d+)/)?.some((v) => v === version) || false)
	.install(DownloadProvider.TrackedDownload)
	.finally(() => {
		if (isDebug()) {
			clearInterval(monitorInterval);
			logger.debug("Peak heap usage: %s", humanReadableSize(peakHeap));
		}
	});
