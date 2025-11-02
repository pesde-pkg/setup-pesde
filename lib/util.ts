import { mkdir } from "node:fs/promises";

import decompress from "decompress";
import type { components } from "@octokit/openapi-types";

export type ReleaseAsset = components["schemas"]["release-asset"];

declare global {
	interface Array<T> {
		filterMap<U>(fn: (item: T) => U | null | undefined): U[];
	}
}

Array.prototype.filterMap = function <T, U>(predicate: (item: T) => U | null | undefined): U[] {
	return this.flatMap((item) => {
		const result = predicate(item);
		return result != null ? [result] : [];
	});
};

export function fallibleToNull<T>(fn: (...args: any[]) => T, ...args: any[]): T | null {
	try {
		return fn(args);
	} catch {
		return null;
	}
}

export type DecompressOptions = Omit<decompress.DecompressOptions, "plugins">;
export async function decompressCommonFormats(
	input: string | Buffer,
	output?: string | DecompressOptions,
	options?: DecompressOptions
): Promise<decompress.File[]> {
	const plugins = ["decompress-tar", "decompress-targz", "decompress-tarbz2", "decompress-tarxz", "decompress-unzip"];
	return decompress(input, output, {
		...options,
		plugins: await Promise.all(plugins.map(async (plugin) => await import(plugin).then((mod) => mod.default())))
	});
}

export type ByteUnit = "B" | "KB" | "MB" | "GB" | "TB" | "PB";
export type HumanReadableSize = `${number} ${ByteUnit}`;

/**
 * Represent a given number of bytes in terms of largest unit it can
 * possibly be represented as, where coefficient of the new a value is
 * at least 1.
 *
 * Optionally, a maximum number of decimal places can be specified,
 * defaulting to 2 when not defined.
 *
 * ## Examples
 * | Bytes               | Decimals | Formatted Value |
 * |---------------------|-----------|-----------------|
 * | `500`               | –         | 500 B           |
 * | `2048`              | –         | 2 KB            |
 * | `1_572_864`         | 1         | 1.5 MB          |
 * | `7_516_192_768`     | 2         | 7.00 GB         |
 * | `1_099_511_627_776` | –         | 1 TB            |
 */
export function humanReadableSize(bytes: number, maxDecimals = 2): HumanReadableSize {
	if (bytes < 0) throw new Error("Bytes must be non-negative");
	if (bytes === 0) return "0 B";

	const units: ByteUnit[] = ["B", "KB", "MB", "GB", "TB", "PB"];

	let size = bytes;
	let i = 0;
	while (size >= 1024 && i < units.length - 1) {
		// start a lowest possible unit of bytes, work the way up
		size /= 1024;
		i++;
	}

	const unit = units[i];
	if (!unit) {
		throw new Error("Bytes value too large");
	}
	return `${parseFloat(size.toFixed(maxDecimals))} ${unit}`;
}

export async function ensureExists(dir: string) {
	try {
		await mkdir(dir, { recursive: true });
	} catch (err) {
		console.error(`Failed to ensure directory existence: ${err}`);
		throw err;
	}
}

export default {};
