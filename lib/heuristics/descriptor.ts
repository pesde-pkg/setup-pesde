import logging from "@/logging.js";
import { currentSystem as arch, detectArch, type Arch } from "./arch.js";
import { currentSystem as os, detectOS, type OS } from "./os.js";
import type { ReleaseAsset } from "@/util.js";

export interface Descriptor {
	os: OS;
	arch: Arch;
}

export class PlatformDescriptor implements Descriptor {
	private static logger = logging.child({ scope: "descriptor" });

	public os: OS;
	public arch: Arch;

	constructor(os: OS, arch: Arch);
	constructor(str: string);

	constructor(osOrStr: OS | string, arch?: Arch) {
		if (arch != undefined) {
			this.os = osOrStr as OS;
			this.arch = arch;
		} else {
			const osFromStr = detectOS(osOrStr);
			const archFromStr = detectArch(osOrStr);

			if (!osFromStr || !archFromStr) {
				PlatformDescriptor.logger.warn(`Unable to detect architecture or OS from '${osOrStr}' confidently, skipping`);
				throw new Error("Malformed input string");
			}

			this.os = osFromStr;
			this.arch = archFromStr;
		}

		return this;
	}

	public static currentPlatform(): PlatformDescriptor {
		return new PlatformDescriptor(os(), arch());
	}

	toString(): string {
		return `${this.os}-${this.arch}`;
	}

	public equals(other: Descriptor) {
		return this.os == other.os && this.arch == other.arch;
	}
}

export class ReleaseAssetDescriptor implements Descriptor {
	private inner: PlatformDescriptor;
	public asset: ReleaseAsset;

	constructor(asset: ReleaseAsset) {
		this.inner = new PlatformDescriptor(asset.name);
		this.asset = asset;
		return this;
	}

	public get os() {
		return this.inner.os;
	}

	public get arch() {
		return this.inner.arch;
	}

	toString(): string {
		return this.inner.toString();
	}

	public equals(other: Descriptor) {
		return this.os == other.os && this.arch == other.arch;
	}
}
