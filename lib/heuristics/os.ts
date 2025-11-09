// Mostly a recreation of rokit's detection logic in TypeScript           //
// See https://github.com/rojo-rbx/rokit/blob/a6b84c/lib/descriptor/os.rs //

export type OS = "Windows" | "macOS" | "Linux";

const OS_SUBSTRINGS: Record<OS, string[]> = {
	Windows: ["windows"],
	macOS: ["macos", "darwin", "apple"],
	Linux: ["linux", "ubuntu", "debian", "fedora"]
};

const OS_FULL_WORDS: Record<OS, string[]> = {
	Windows: ["win", "win32", "win64"],
	macOS: ["mac", "osx"],
	Linux: []
};

/**
 * Returns the OS of the current host system.
 */
export function currentSystem(): OS {
	if (process.platform === "win32" || process.platform === "cygwin") return "Windows";
	if (process.platform === "darwin") return "macOS";
	if (process.platform === "linux") return "Linux";

	throw new Error(`Unsupported OS: ${process.platform}`);
}

/**
 * Detects an operating system by identifying keywords in a given search string.
 * Returns `undefined` if no OS is confidently detected.
 *
 * ## Example usage:
 *
 * ```js
 * console.log(detectOS("build-linux-aarch64.tar.gz")); // → "Linux"
 * console.log(detectOS("Darwin.tar.gz"));              // → "macOS"
 * console.log(detectOS("ubuntu-x64"));                 // → "Linux"
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
