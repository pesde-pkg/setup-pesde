import { dirname, join } from "node:path";
import { env, exit } from "node:process";
import { isDeepStrictEqual } from "node:util";
import { access } from "node:fs/promises";
import { homedir } from "node:os";

import { DownloadProvider } from "@/index.js";
import logging from "@/logging/index.js";
import { ToolManager } from "@/tool.js";
import { cacheKey, PESDE_PACKAGE_DIRS } from "./cache.js";

import { cacheDir, find } from "@actions/tool-cache";
import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { rmRF } from "@actions/io";
import { crossDeviceMoveDir } from "@/util.js";

export type Tool = "pesde" | "lune";
export type Repo = { owner: string; repo: string };
const tools: Record<Tool, Repo> = {
	pesde: { owner: "pesde-pkg", repo: "pesde" },
	lune: { owner: "lune-org", repo: "lune" }
};

const parentLogger = logging.child({ scope: "actions" });
parentLogger.exitOnError = true;

const PESDE_HOME = expandRelativeToWorkspace(core.getInput("home") || env.PESDE_HOME || "~/.pesde");
core.exportVariable("PESDE_HOME", PESDE_HOME);

parentLogger.info(`Discovered pesde home directory: ${PESDE_HOME}`);

function expandRelativeToWorkspace(path: string) {
	const homeDir = homedir();

	// expand tilde
	if (path === "~" || path.startsWith("~/")) {
		path = path.replace(/^~(?=$|\/|\\)/, homeDir);
	}

	// expand $HOME and ${HOME}
	path = path.replace(/\$HOME/g, homeDir).replace(/\$\{HOME\}/g, homeDir);

	return path;
}

// change directory into the root specified
// chdir(core.getInput("cwd"));

async function setupTool(repo: Repo, version: string) {
	const logger = parentLogger.child({ scope: "actions.setupTool" });

	let toolPath = find(repo.repo, version);
	if (!toolPath) {
		let versionOpt: string | ((version: string) => boolean) = version;
		if (isDeepStrictEqual(repo, tools.pesde) && version !== "latest") {
			// pesde releases include build metadata for corresponding registry version
			// so we only compare the version part

			// note: this regex creates two matches: one with the leading 'v' and one without,
			// so the user can choose to not specify a leading 'v' in their version input
			versionOpt = (potential) => potential.match(/^v?(\d+\.\d+\.\d+)/)?.some((v) => v === version) || false;
		}

		toolPath = await new ToolManager(repo.owner, repo.repo)
			.version(versionOpt)
			.install(DownloadProvider.Actions)
			.then((result) => (result.path ? Promise.resolve(result) : Promise.reject("Download failed.")))
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

// on windows, it is impossible for `saveCache` to cache unless the pesde home dir can
// be represented relatively to the github workspace. so, we create a tempdir which can
// be cached, and transform it during restore. on all other platforms, we just use the
// regular pesde home
const pesdeHome = process.platform === "win32" ? join(dirname(env.GITHUB_WORKSPACE!), ".pesde-tmp") : PESDE_HOME;
const cacheDirs = [...PESDE_PACKAGE_DIRS, pesdeHome];

if (core.getState("post") === "true") {
	// post-run invocation, just cache or exit

	if (core.getState("needsCache") === "true") {
		await crossDeviceMoveDir(PESDE_HOME, pesdeHome); // both paths are same everywhere except on windows

		const cacheableDirs = await Promise.all(
			// filter out dirs which do not exist and cannot be cached
			cacheDirs.map(async (p) => {
				return await access(p)
					.then(() => p)
					.catch(() => null);
			})
		).then((results) => results.filter((p): p is string => p != null));

		cacheLogger.debug(`Can cache dirs: ${JSON.stringify(cacheableDirs)}`);

		if (cacheableDirs.length != 0) {
			const cacheId = await cache.saveCache(cacheableDirs, await cacheKey());
			core.saveState("needsCache", false); // notify future runs caching isn't required

			// remove only for windows, where it is a temp dir
			if (process.platform === "win32") await rmRF(pesdeHome);

			cacheLogger.info(`Successfully cached to ${cacheId}, exiting`);
		}
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
	await cache.restoreCache(cacheDirs, await cacheKey()).then(async (hit) => {
		if (!hit) {
			cacheLogger.warn("Cache miss, dispatching future post-run to save cache");
			core.saveState("needsCache", true); // notify future runs that they need to cache
			return;
		}

		// move the temporary pesde home onto the expected path (windows only)
		await crossDeviceMoveDir(pesdeHome, PESDE_HOME);

		cacheLogger.info(`Restored cache key ${hit} successfully`);
	});
}
