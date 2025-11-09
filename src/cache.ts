import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { currentSystem as currentOS } from "@/heuristics/os.js";
import { currentSystem as currentArch } from "@/heuristics/arch.js";

export const PESDE_PACKAGE_DIRS = [
	join(process.env.GITHUB_WORKSPACE!, "luau_packages"),
	join(process.env.GITHUB_WORKSPACE!, "lune_packages"),
	join(process.env.GITHUB_WORKSPACE!, "roblox_packages"),
	join(process.env.GITHUB_WORKSPACE!, "roblox_server_packages")
];

export async function cacheKey(): Promise<string> {
	const hashFiles = async (...paths: string[]) => {
		const hash = createHash("sha256");
		for (const path of paths) {
			const file = await readFile(path)
				.then((contents) => contents.toString())
				.catch((err: NodeJS.ErrnoException) =>
					err.code == "ENOENT" ? Promise.resolve(`missing(${err.path})`) : Promise.reject(err)
				);

			hash.update(file);
		}

		return hash.digest("hex");
	};

	return `pesde-${currentOS()}-${currentArch().toUpperCase()}-${await hashFiles("pesde.toml", "pesde.lock")}`;
}
