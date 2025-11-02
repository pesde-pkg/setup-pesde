import { ToolManager } from "./tool.js";
import { DownloadProvider } from "./download.js";

// import { isDebug } from "./logging.js";
// import logger from "./logging.js";
// import { humanReadableSize } from "./util.js";
//
// monitor peak heap usage for debugging
// if (isDebug()) {
// 	var peakHeap = 0;
// 	var monitorInterval = setInterval(() => {
// 		const { heapUsed } = process.memoryUsage();
// 		if (heapUsed > peakHeap) peakHeap = heapUsed;
// 	}, 500); // check every 500ms
// }

// await new ToolManager("lune-org", "lune")
// 	.version((v) => v.match(/^v?0\.10(?:\.\d+)?$/g) != null)
// 	.install(DownloadProvider.TrackedDownload)
// 	.finally(() => {
// 		if (isDebug()) {
// 			clearInterval(monitorInterval);
// 			logger.debug("Peak heap usage: %s", humanReadableSize(peakHeap));
// 		}
// 	});

// todo: - make this a `lib/` and have an `src/` for just the actions part
//       - we can also make an `Io` interface which we implement for two classes,
//         one for github actions using `@actions/io` and another using node apis
// todo: structured errors

export { ToolManager, DownloadProvider };
