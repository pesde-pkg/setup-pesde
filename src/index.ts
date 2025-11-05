import { dirname } from "node:path";

import { DownloadProvider } from "@/index.js";
import logging from "@/logging/index.js";
import { ToolManager } from "@/tool.js";
import { cacheKey, PESDE_PACKAGE_DIRS } from "./cache.js";

import { cacheDir, find } from "@actions/tool-cache";
import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { exit } from "node:process";

export type Tool = "pesde" | "lune";
export type Repo = { owner: string; repo: string };
const tools: Record<Tool, Repo> = {
	pesde: { owner: "pesde-pkg", repo: "pesde" },
	lune: { owner: "lune-org", repo: "lune" }
};

const parentLogger = logging.child({ scope: "actions" });
parentLogger.exitOnError = true;

async function setupTool(repo: Repo, version: string) {
	const logger = parentLogger.child({ scope: "actions.setupTool" });

	let toolPath = find(repo.repo, version);
	if (!toolPath) {
		toolPath = await new ToolManager(repo.owner, repo.repo)
			.version(version)
			.install(DownloadProvider.Actions)
			.then((optionalPath) => (optionalPath ? Promise.resolve(optionalPath) : Promise.reject("Download failed.")))
			.catch((err) => void logger.error(err) as never)
			.then((result) =>
				result.path
					? cacheDir(dirname(result.path), repo.repo, result.version)
					: (logger.error("Install failed.") as never)
			);
	}

	core.addPath(toolPath);
}

const cacheLogger = parentLogger.child({ scope: "actions.cache" });

if (core.getState("post") === "true") {
	// post-run invocation, just cache or exit

	if (core.getState("needsCache") === "true") {
		const cacheId = await cache.saveCache(PESDE_PACKAGE_DIRS, await cacheKey());
		core.saveState("needsCache", false); // notify future runs caching isn't required

		cacheLogger.info(`Successfully cached to ${cacheId}, exiting`);
	} else {
		cacheLogger.info("No caching required, exiting");
	}

	// notify future runs that they will no longer be a post-run
	core.saveState("post", false);
	exit(0);
}

const luneVersion = core.getInput("lune-version");
if (luneVersion !== "") await setupTool(tools.lune, luneVersion);

await setupTool(tools.pesde, core.getInput("version") || "latest");

// notify future runs that they will be the post-run
core.saveState("post", true);

if (core.getBooleanInput("cache")) {
	await cache.restoreCache(PESDE_PACKAGE_DIRS, await cacheKey()).then((hit) => {
		if (!hit) {
			cacheLogger.warn("Cache miss, dispatching future post-run to save cache");
			core.saveState("needsCache", true); // notify future runs that they need to cache
			return;
		}

		cacheLogger.info(`Restored cache key ${hit} successfully`);
	});
}
