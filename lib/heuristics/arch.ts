// Mostly a recreation of rokit's detection logic in TypeScript.            //
// See https://github.com/rojo-rbx/rokit/blob/a6b84c/lib/descriptor/arch.rs //

import { detectOS } from "./os.js";

export type Arch = "arm64" | "x64" | "arm32" | "x86";

const ARCH_SUBSTRINGS: Record<Arch, string[]> = {
	arm64: ["aarch64", "arm64", "armv9"],
	x64: ["x86-64", "x86_64", "amd64", "win64", "win-x64"],
	arm32: ["arm32", "armv7"],
	x86: ["i686", "i386", "win32", "win-x86"]
};

const ARCH_FULL_WORDS: Record<Arch, string[]> = {
	arm64: [],
	x64: ["x64", "win"],
	arm32: ["arm"],
	x86: ["x86"]
};

/**
 * Returns the architecture of the current host system.
 */
export function currentSystem(): Arch {
	if (process.arch === "arm64" || process.arch == "x64") return process.arch;
	if (process.arch === "arm") return "arm32";
	if (process.arch === "ia32") return "x86";

	throw new Error(`Unsupported architecture: ${process.arch}`);
}

/**
 * Detects an architecture by identifying keywords in a search string.
 * Returns `undefined` if no architecture is confidently detected.
 *
 * ## Example usage:
 *
 * ```js
 * console.log(detectArch("build_win64_release"));     // → "x64"
 * console.log(detectArch("kernel_aarch64_debug"));    // → "arm64"
 * console.log(detectArch("libarmv7.so"));             // → "arm32"
 * console.log(detectArch("installer_win32"));         // → "x86"
 * console.log(detectArch("Universal macos binary"));  // → "x64"
 * ```
 */
export function detectArch(searchString: string): Arch | undefined {
	const lower = searchString.toLowerCase();

	// substring heuristics
	for (const arch of Object.keys(ARCH_SUBSTRINGS) as Arch[]) {
		for (const keyword of ARCH_SUBSTRINGS[arch]) {
			if (lower.includes(keyword)) {
				return arch;
			}
		}
	}

	// full word heuristics
	const parts = lower.split(/[^a-z0-9]+/);
	for (const arch of Object.keys(ARCH_FULL_WORDS) as Arch[]) {
		for (const keyword of ARCH_FULL_WORDS[arch]) {
			if (parts.includes(keyword)) {
				return arch;
			}
		}
	}

	// hack: macOS universal binaries fallback
	if (lower.includes("universal") && detectOS(searchString) === "macOS") {
		return "x64";
	}

	return undefined;
}

// todo: tests
