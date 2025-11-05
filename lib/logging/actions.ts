import { stripVTControlCharacters } from "node:util";

import Transport from "winston-transport";
import * as core from "@actions/core";

// remove the scope part, separated from the message by a colon
function stripScopeFromMessage(str: string): string {
	const ansiRemoved = stripVTControlCharacters(str);
	const parts = ansiRemoved.split(":");
	return parts.slice(1).join(":").trimStart();
}

export class ActionsTransport extends Transport {
	constructor(opts?: Transport.TransportStreamOptions) {
		super(opts);
	}

	override log(info: any, callback: () => void): void {
		setImmediate(() => this.emit("logged", info));

		const level = info[Symbol.for("level")];
		const message = stripScopeFromMessage(info.message);
		switch (level) {
			case "info":
				core.info(message);
				break;
			case "warn":
				core.warning(message);
				break;
			case "error":
				core.error(message);
				break;
			case "debug":
				core.debug(message);
				break;
		}

		callback();
	}
}
