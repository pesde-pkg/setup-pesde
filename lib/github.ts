import log, { isDebug } from "./logging.js";

import { getInput } from "@actions/core";
import { getOctokit } from "@actions/github";

let logger = log.child({ scope: "github" });

export function redactToken(token?: string): string {
	if (!token) return "<none>";
	const prefix = token.substring(0, 5); // "ghp_abc" or first 7 chars
	return token.replace(new RegExp(token, "g"), `${prefix}***`);
}

export const token = getInput("token") || process.env.GITHUB_TOKEN; // todo: decouple this from lib
logger.info(`Initalized GitHub client with token: ${redactToken(token)}`);

type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export function fetchWithLogs(logLevel: "info" | "warn" | "debug" | "error"): FetchFunction {
	return async (input, init) => {
		const url = String(input);
		const method = init?.method || "GET";
		logger[logLevel](`→ ${method} ${url}`);

		const start = performance.now();
		const resp = await fetch(input, init);
		const duration = (performance.now() - start).toFixed(2);
		logger[logLevel](`← ${resp.status} ${method} ${url} (${duration}μs)`);

		return resp;
	};
}

logger = logger.child({ scope: "github.octokit" });
export const client: ReturnType<typeof getOctokit> = getOctokit(token!, {
	request: {
		// add a fetch hook for debug logging
		fetch: isDebug() ? fetchWithLogs("debug") : fetch
	},

	log: {
		debug: logger.debug,
		info: logger.info,
		warn: logger.warn,
		error: logger.error
	}
});
