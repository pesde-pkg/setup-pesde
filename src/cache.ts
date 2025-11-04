import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const PESDE_PACKAGE_DIRS = [
	join(process.env.GITHUB_WORKSPACE!, "luau_packages"),
	join(process.env.GITHUB_WORKSPACE!, "lune_packages"),
	join(process.env.GITHUB_WORKSPACE!, "roblox_packages"),
	join(process.env.GITHUB_WORKSPACE!, "roblox_server_packages"),
	join(process.env.HOME!, ".pesde")
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

	return `pesde-${process.platform}-${process.arch}-${await hashFiles("pesde.toml", "pesde.lock")}`;
}
