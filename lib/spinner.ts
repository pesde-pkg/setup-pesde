import Transport from "winston-transport";
import type { Ora } from "ora";
import winston from "winston";

export class SpinnerTransport extends Transport {
	private console = new winston.transports.Console();
	private spinner: Ora | null = null;

	constructor(opts?: Transport.TransportStreamOptions) {
		super(opts);
	}

	setSpinner(spinner: Ora): Ora {
		this.spinner = spinner;
		return spinner;
	}

	override log(info: any, callback: () => void): void {
		setImmediate(() => this.emit("logged", info));
		// fallback to console.log if no winston console
		const log = this.console.log?.bind(this.console) ?? console.log;

		// stop and resume spinner after logging message
		if (this.spinner && this.spinner.isSpinning) {
			const spinnerText = this.spinner.text;
			this.spinner.stop();

			log(info, callback);

			this.spinner.text = spinnerText;
			this.spinner.start();
		} else {
			// regular log, no spinner
			log(info, callback);
		}
	}
}
