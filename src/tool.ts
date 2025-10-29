import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { basename, join } from "node:path";

import pkg from "../package.json" with { type: "json" };
import { downloadWithProgress } from "./download.js";
import { client as gh } from "./github.js";
import { PlatformDescriptor, ReleaseAssetDescriptor } from "./heuristics/descriptor.js";
import log from "./logging.js";
import _, { decompressCommonFormats, fallibleToNull, humanReadableSize, type ReleaseAsset } from "./util.js";

import type { Endpoints } from "@octokit/types";

export class ToolManager {
	// base arguments for any repo related operations
	private githubRepo: Endpoints["GET /repos/{owner}/{repo}"]["parameters"];
	private versionOrPredicate: string | ((version: string) => boolean) = "latest";
	private logger = log.child({ scope: "toolmanager" });

	constructor(owner: string, repo: string) {
		this.githubRepo = { owner, repo };
	}

	public version(versionOrPredicate: string | ((version: string) => boolean)) {
		this.versionOrPredicate = versionOrPredicate;
		return this;
	}

	public async install(installDir = import.meta.dirname, binaryName = this.githubRepo.repo): Promise<string | undefined> {
		const logger = this.logger.child({ scope: "toolmanager.install" });

		const assetDescriptor = await this.findCompatibleAsset();
		if (assetDescriptor == null) {
			logger.error(
				`No compatible artifact found for current system for ${this.githubRepo.owner}/${this.githubRepo.repo}`
			);
			throw new Error("No artifact found");
		}

		const { size: assetSize, name: assetName } = assetDescriptor.asset;

		logger.info(`Attempting to download '${assetName}' (${humanReadableSize(assetSize)})`);

		const tempdir = await mkdtemp(join(tmpdir(), `${pkg.name}-`));
		try {
			const compressedArchive = join(tempdir, assetDescriptor.asset.name);

			// download and decompress the file
			await downloadWithProgress(assetDescriptor.asset.browser_download_url, compressedArchive, assetSize);
			return await decompressCommonFormats(compressedArchive, installDir, {
				filter: (file) => basename(file.path) == binaryName,
				strip: 5 // fixme: figure this value out
			})
				.then((files) =>
					files.length == 0
						? Promise.reject(`Could not find binary '${binaryName} in downloaded artifact'`)
						: Promise.resolve(files)
				)
				.then(() => join(installDir, binaryName))
				.catch((err) => void logger.error(err));
		} finally {
			await rm(tempdir, { recursive: true });
		}
	}

	public async findCompatibleAsset() {
		const logger = this.logger.child({ scope: "toolmanager.findCompatibleAsset" });

		const { version, assets } = await this.resolveVersion();
		logger.info(`Received ${assets.length} assets for ${this.githubRepo.repo}@${version}`);

		const assetDescriptors = assets.filterMap((asset) => fallibleToNull(() => new ReleaseAssetDescriptor(asset)));
		const currentSystem = PlatformDescriptor.currentPlatform();

		for (const descriptor of assetDescriptors) {
			if (descriptor.equals(currentSystem)) {
				logger.info(`Found matching artifact for ${currentSystem}: ${descriptor.asset.name}`);
				return descriptor;
			}

			logger.debug(`${descriptor.asset.name} →  asset: ${descriptor}, system: ${currentSystem}`);
		}

		return null;
	}

	private async resolveVersion(): Promise<{ version: string; assets: ReleaseAsset[] }> {
		const logger = this.logger.child({ scope: "toolmanager.resolveVersion" });
		const processRelease = ({ data }: { data: { tag_name: string; assets: ReleaseAsset[] } }) => {
			// extract only the tag name and assets from a release
			return { version: data.tag_name, assets: data.assets };
		};

		if (typeof this.versionOrPredicate == "string") {
			if (this.versionOrPredicate == "latest") {
				logger.warn("No explicit version requested, defaulting to latest");
				return await gh.rest.repos.getLatestRelease({ ...this.githubRepo }).then(processRelease);
			} else {
				logger.info("Attempting to fetch version %s", this.versionOrPredicate);
				return await gh.rest.repos
					.getReleaseByTag({
						...this.githubRepo,
						tag: this.versionOrPredicate
					})
					.then(processRelease);
			}
		} else if (typeof this.versionOrPredicate == "function") {
			logger.debug("Version predicate function provided, will attempt to filter");
			const { data: releases } = await gh.rest.repos.listReleases({ ...this.githubRepo });
			for (const release of releases) {
				if (this.versionOrPredicate(release.tag_name)) {
					return processRelease({ data: release });
				}
			}
		}

		return Promise.reject("unreachable: invalid versionOrPredicate type");
	}
}
