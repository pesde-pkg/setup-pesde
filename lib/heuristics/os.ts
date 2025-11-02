// Mostly a recreation of rokit's detection logic in TypeScript           //
// See https://github.com/rojo-rbx/rokit/blob/a6b84c/lib/descriptor/os.rs //

export type OS = "windows" | "macos" | "linux";

const OS_SUBSTRINGS: Record<OS, string[]> = {
	windows: ["windows"],
	macos: ["macos", "darwin", "apple"],
	linux: ["linux", "ubuntu", "debian", "fedora"]
};

const OS_FULL_WORDS: Record<OS, string[]> = {
	windows: ["win", "win32", "win64"],
	macos: ["mac", "osx"],
	linux: []
};

/**
 * Returns the OS of the current host system.
 */
export function currentSystem(): OS {
	if (process.platform === "win32" || process.platform === "cygwin") return "windows";
	if (process.platform === "darwin") return "macos";
	if (process.platform === "linux") return "linux";

	throw new Error(`Unsupported OS: ${process.platform}`);
}

/**
 * Detects an operating system by identifying keywords in a given search string.
 * Returns `undefined` if no OS is confidently detected.
 *
 * ## Example usage:
 *
 * ```js
 * console.log(detectOS("build-linux-aarch64.tar.gz")); // → "linux"
 * console.log(detectOS("Darwin.tar.gz"));              // → "macos"
 * console.log(detectOS("ubuntu-x64"));                 // → "linux"
 * ```
 */
export function detectOS(searchString: string): OS | undefined {
	const lower = searchString.toLowerCase();

	// substring heuristics
	for (const os of Object.keys(OS_SUBSTRINGS) as OS[]) {
		for (const keyword of OS_SUBSTRINGS[os]) {
			if (lower.includes(keyword)) {
				return os;
			}
		}
	}

	// full word heuristics
	const parts = lower.split(/[^a-z0-9]+/);
	for (const os of Object.keys(OS_FULL_WORDS) as OS[]) {
		for (const keyword of OS_FULL_WORDS[os]) {
			// check both as a full word and as a substring
			if (parts.includes(keyword) || lower.includes(keyword)) {
				return os;
			}
		}
	}

	return undefined;
}

// todo: add tests
