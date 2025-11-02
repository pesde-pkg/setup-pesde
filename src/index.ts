import { dirname } from "node:path";

import { DownloadProvider } from "@/index.js";
import logging from "@/logging.js";
import { ToolManager } from "@/tool.js";

import { cacheDir, find } from "@actions/tool-cache";
import * as core from "@actions/core";

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
	if (toolPath == "") {
		toolPath = await new ToolManager(repo.owner, repo.repo)
			.version(version)
			.install(DownloadProvider.Actions)
			.then((optionalPath) => (optionalPath ? Promise.resolve(optionalPath) : Promise.reject("Download failed.")))
			.catch((err) => void logger.error(err) as never)
			.then((binaryPath) => cacheDir(dirname(binaryPath), repo.repo, version)); // todo: figure out version, this clobbers cache if version is "latest"
	}

	core.addPath(toolPath);
}

await setupTool(tools.lune, core.getInput("lune-version"));
await setupTool(tools.pesde, core.getInput("version"));
