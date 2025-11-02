// src/index.ts
import { dirname } from "path";

// lib/tool.ts
import { tmpdir } from "os";
import { mkdtemp, rm } from "fs/promises";
import { basename, join } from "path";

// package.json
var package_default = {
  name: "setup-pesde",
  version: "0.1.0",
  description: "",
  main: "dist/index.js",
  type: "module",
  scripts: {
    prettier: "node --experimental-strip-types node_modules/prettier/bin/prettier.cjs",
    build: "tsup",
    dev: "pnpm build && NODE_LOG=debug GITHUB_TOKEN=$(gh auth token) node dist/",
    test: 'echo "Error: no test specified" && exit 1'
  },
  keywords: [],
  author: "",
  license: "GPL-3.0-only",
  engines: {
    pnpm: "^10.13.1",
    node: "^16.20.2"
  },
  dependencies: {
    "@actions/core": "^1.11.1",
    "@actions/exec": "^1.1.1",
    "@actions/github": "^6.0.1",
    "@actions/io": "^1.1.3",
    "@actions/tool-cache": "^2.0.2",
    "@octokit/openapi-types": "^20.0.0",
    decompress: "npm:@xhmikosr/decompress@^10.2.0",
    "decompress-tar": "npm:@xhmikosr/decompress-tar@^8.1.0",
    "decompress-tarbz2": "npm:@xhmikosr/decompress-tarbz2@^8.1.0",
    "decompress-targz": "npm:@xhmikosr/decompress-targz@^8.1.0",
    "decompress-tarxz": "npm:@felipecrs/decompress-tarxz@^5.0.4",
    "decompress-unzip": "npm:@xhmikosr/decompress-unzip@^7.1.0",
    "is-interactive": "^2.0.0",
    ora: "^9.0.0",
    winston: "^3.18.3",
    "winston-transport": "^4.9.0"
  },
  devDependencies: {
    "@octokit/types": "^15.0.1",
    "@types/decompress": "^4.2.7",
    "@types/node": "^24.9.1",
    eslint: "^9.38.0",
    "eslint-plugin-prettier": "^5.5.4",
    prettier: "^3.6.2",
    tsup: "^8.5.0",
    typescript: "^5.9.3"
  }
};

// lib/logging.ts
import { appendFileSync, existsSync } from "fs";

// lib/spinner.ts
import Transport from "winston-transport";
import winston from "winston";
var SpinnerTransport = class extends Transport {
  console = new winston.transports.Console();
  spinner = null;
  constructor(opts) {
    super(opts);
  }
  setSpinner(spinner) {
    this.spinner = spinner;
    return spinner;
  }
  log(info, callback) {
    setImmediate(() => this.emit("logged", info));
    const log = this.console.log?.bind(this.console) ?? console.log;
    if (this.spinner && this.spinner.isSpinning) {
      const spinnerText = this.spinner.text;
      this.spinner.stop();
      log(info, callback);
      this.spinner.text = spinnerText;
      this.spinner.start();
    } else {
      log(info, callback);
    }
  }
};

// lib/logging.ts
import { isDebug as actionsDebug } from "@actions/core";
import winston2 from "winston";
var isDebug = () => process.env.DEV_DEBUG || process.env.NODE_LOG === "debug" || actionsDebug();
var baseFormat = winston2.format.combine(
  winston2.format.simple(),
  winston2.format.errors(),
  winston2.format.splat(),
  winston2.format((info) => {
    if (info.scope) {
      info.message = `\x1B[2m${info.scope}\x1B[0m: ${info.message}`;
      delete info.scope;
    }
    return info;
  })()
);
var logging_default = winston2.createLogger({
  level: isDebug() ? "debug" : "info",
  format: isDebug() && process.env.NODE_ENV === "production" ? winston2.format.json() : winston2.format.combine(baseFormat, winston2.format.cli()),
  transports: [
    new SpinnerTransport(),
    (() => {
      const logFile = `${package_default.name}.log`;
      const lineStarter = existsSync(logFile) ? "\n" : "";
      const now = /* @__PURE__ */ new Date();
      appendFileSync(
        logFile,
        `${lineStarter}// ${package_default.name} started at ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}
`
      );
      return new winston2.transports.File({
        filename: logFile,
        format: winston2.format.combine(baseFormat, winston2.format.uncolorize()),
        level: "debug"
      });
    })()
    // todo: transport for actions core
  ]
});

// lib/github.ts
import { getInput } from "@actions/core";
import { getOctokit } from "@actions/github";
var logger = logging_default.child({ scope: "github" });
function redactToken(token2) {
  if (!token2) return "<none>";
  const prefix = token2.substring(0, 5);
  return token2.replace(new RegExp(token2, "g"), `${prefix}***`);
}
var token = getInput("token") || process.env.GITHUB_TOKEN;
logger.info(`Initalized GitHub client with token: ${redactToken(token)}`);
function fetchWithLogs(logLevel) {
  return async (input, init) => {
    const url = String(input);
    const method = init?.method || "GET";
    logger[logLevel](`\u2192 ${method} ${url}`);
    const start = performance.now();
    const resp = await fetch(input, init);
    const duration = (performance.now() - start).toFixed(2);
    logger[logLevel](`\u2190 ${resp.status} ${method} ${url} (${duration}\u03BCs)`);
    return resp;
  };
}
logger = logger.child({ scope: "github.octokit" });
var client = getOctokit(token, {
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

// lib/heuristics/os.ts
var OS_SUBSTRINGS = {
  windows: ["windows"],
  macos: ["macos", "darwin", "apple"],
  linux: ["linux", "ubuntu", "debian", "fedora"]
};
var OS_FULL_WORDS = {
  windows: ["win", "win32", "win64"],
  macos: ["mac", "osx"],
  linux: []
};
function currentSystem() {
  if (process.platform === "win32" || process.platform === "cygwin") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.platform === "linux") return "linux";
  throw new Error(`Unsupported OS: ${process.platform}`);
}
function detectOS(searchString) {
  const lower = searchString.toLowerCase();
  for (const os of Object.keys(OS_SUBSTRINGS)) {
    for (const keyword of OS_SUBSTRINGS[os]) {
      if (lower.includes(keyword)) {
        return os;
      }
    }
  }
  const parts = lower.split(/[^a-z0-9]+/);
  for (const os of Object.keys(OS_FULL_WORDS)) {
    for (const keyword of OS_FULL_WORDS[os]) {
      if (parts.includes(keyword) || lower.includes(keyword)) {
        return os;
      }
    }
  }
  return void 0;
}

// lib/heuristics/arch.ts
var ARCH_SUBSTRINGS = {
  arm64: ["aarch64", "arm64", "armv9"],
  x64: ["x86-64", "x86_64", "amd64", "win64", "win-x64"],
  arm32: ["arm32", "armv7"],
  x86: ["i686", "i386", "win32", "win-x86"]
};
var ARCH_FULL_WORDS = {
  arm64: [],
  x64: ["x64", "win"],
  arm32: ["arm"],
  x86: ["x86"]
};
function currentSystem2() {
  if (process.arch === "arm64" || process.arch == "x64") return process.arch;
  if (process.arch === "arm") return "arm32";
  if (process.arch === "ia32") return "x86";
  throw new Error(`Unsupported architecture: ${process.arch}`);
}
function detectArch(searchString) {
  const lower = searchString.toLowerCase();
  for (const arch of Object.keys(ARCH_SUBSTRINGS)) {
    for (const keyword of ARCH_SUBSTRINGS[arch]) {
      if (lower.includes(keyword)) {
        return arch;
      }
    }
  }
  const parts = lower.split(/[^a-z0-9]+/);
  for (const arch of Object.keys(ARCH_FULL_WORDS)) {
    for (const keyword of ARCH_FULL_WORDS[arch]) {
      if (parts.includes(keyword)) {
        return arch;
      }
    }
  }
  if (lower.includes("universal") && detectOS(searchString) === "macos") {
    return "x64";
  }
  return void 0;
}

// lib/heuristics/descriptor.ts
var PlatformDescriptor = class _PlatformDescriptor {
  static logger = logging_default.child({ scope: "descriptor" });
  os;
  arch;
  constructor(osOrStr, arch) {
    if (arch != void 0) {
      this.os = osOrStr;
      this.arch = arch;
    } else {
      const osFromStr = detectOS(osOrStr);
      const archFromStr = detectArch(osOrStr);
      if (!osFromStr || !archFromStr) {
        _PlatformDescriptor.logger.warn(`Unable to detect architecture or OS from '${osOrStr}' confidently, skipping`);
        throw new Error("Malformed input string");
      }
      this.os = osFromStr;
      this.arch = archFromStr;
    }
    return this;
  }
  static currentPlatform() {
    return new _PlatformDescriptor(currentSystem(), currentSystem2());
  }
  toString() {
    return `${this.os}-${this.arch}`;
  }
  equals(other) {
    return this.os == other.os && this.arch == other.arch;
  }
};
var ReleaseAssetDescriptor = class {
  inner;
  asset;
  constructor(asset) {
    this.inner = new PlatformDescriptor(asset.name);
    this.asset = asset;
    return this;
  }
  get os() {
    return this.inner.os;
  }
  get arch() {
    return this.inner.arch;
  }
  toString() {
    return this.inner.toString();
  }
  equals(other) {
    return this.os == other.os && this.arch == other.arch;
  }
};

// lib/util.ts
import { mkdir } from "fs/promises";
import decompress from "decompress";
Array.prototype.filterMap = function(predicate) {
  return this.flatMap((item) => {
    const result = predicate(item);
    return result != null ? [result] : [];
  });
};
function fallibleToNull(fn, ...args) {
  try {
    return fn(args);
  } catch {
    return null;
  }
}
async function decompressCommonFormats(input, output, options) {
  const plugins = ["decompress-tar", "decompress-targz", "decompress-tarbz2", "decompress-tarxz", "decompress-unzip"];
  return decompress(input, output, {
    ...options,
    plugins: await Promise.all(plugins.map(async (plugin) => await import(plugin).then((mod) => mod.default())))
  });
}
function humanReadableSize(bytes, maxDecimals = 2) {
  if (bytes < 0) throw new Error("Bytes must be non-negative");
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  const unit = units[i];
  if (!unit) {
    throw new Error("Bytes value too large");
  }
  return `${parseFloat(size.toFixed(maxDecimals))} ${unit}`;
}
async function ensureExists(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    console.error(`Failed to ensure directory existence: ${err}`);
    throw err;
  }
}

// lib/tool.ts
var ToolManager = class {
  // base arguments for any repo related operations
  githubRepo;
  versionOrPredicate = "latest";
  logger = logging_default.child({ scope: "toolmanager" });
  constructor(owner, repo) {
    this.githubRepo = { owner, repo };
  }
  version(versionOrPredicate) {
    this.versionOrPredicate = versionOrPredicate;
    return this;
  }
  async install(download, installDir = import.meta.dirname, binaryName = this.githubRepo.repo) {
    const logger3 = this.logger.child({ scope: "toolmanager.install" });
    const assetDescriptor = await this.findCompatibleAsset();
    if (assetDescriptor == null) {
      logger3.error(
        `No compatible artifact found for current system for ${this.githubRepo.owner}/${this.githubRepo.repo}`
      );
      throw new Error("No artifact found");
    }
    const { size: assetSize, name: assetName } = assetDescriptor.asset;
    logger3.info(`Attempting to download '${assetName}' (${humanReadableSize(assetSize)})`);
    const tempdir = await mkdtemp(join(tmpdir(), `${package_default.name}-`));
    try {
      const compressedArchive = join(tempdir, assetDescriptor.asset.name);
      await download(assetDescriptor.asset.browser_download_url, compressedArchive, assetSize);
      return await decompressCommonFormats(compressedArchive, installDir, {
        filter: (file) => basename(file.path) == binaryName,
        strip: 5
        // fixme: figure this value out
      }).then(
        (files) => files.length == 0 ? Promise.reject(`Could not find binary '${binaryName} in downloaded artifact'`) : Promise.resolve(files)
      ).then(() => join(installDir, binaryName)).catch((err) => void logger3.error(err));
    } finally {
      await rm(tempdir, { recursive: true });
    }
  }
  async findCompatibleAsset() {
    const logger3 = this.logger.child({ scope: "toolmanager.findCompatibleAsset" });
    const { version, assets } = await this.resolveVersion();
    logger3.info(`Received ${assets.length} assets for ${this.githubRepo.repo}@${version}`);
    const assetDescriptors = assets.filterMap((asset) => fallibleToNull(() => new ReleaseAssetDescriptor(asset)));
    const currentSystem3 = PlatformDescriptor.currentPlatform();
    for (const descriptor of assetDescriptors) {
      if (descriptor.equals(currentSystem3)) {
        logger3.info(`Found matching artifact for ${currentSystem3}: ${descriptor.asset.name}`);
        return descriptor;
      }
      logger3.debug(`${descriptor.asset.name} \u2192  asset: ${descriptor}, system: ${currentSystem3}`);
    }
    return null;
  }
  async resolveVersion() {
    const logger3 = this.logger.child({ scope: "toolmanager.resolveVersion" });
    const processRelease = ({ data }) => {
      return { version: data.tag_name, assets: data.assets };
    };
    if (typeof this.versionOrPredicate == "string") {
      if (this.versionOrPredicate == "latest") {
        logger3.warn("No explicit version requested, defaulting to latest");
        return await client.rest.repos.getLatestRelease({ ...this.githubRepo }).then(processRelease);
      } else {
        logger3.info("Attempting to fetch version %s", this.versionOrPredicate);
        return await client.rest.repos.getReleaseByTag({
          ...this.githubRepo,
          tag: this.versionOrPredicate
        }).then(processRelease);
      }
    } else if (typeof this.versionOrPredicate == "function") {
      logger3.debug("Version predicate function provided, will attempt to filter");
      const { data: releases } = await client.rest.repos.listReleases({ ...this.githubRepo });
      for (const release of releases) {
        if (this.versionOrPredicate(release.tag_name)) {
          return processRelease({ data: release });
        }
      }
    }
    return Promise.reject("unreachable: invalid versionOrPredicate type");
  }
};

// lib/download.ts
import * as fs from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import path from "path";
import isInteractive from "is-interactive";
import ora from "ora";
var logger2 = logging_default.child({ scope: "download" });
var DownloadProvider = {
  TrackedDownload: downloadWithProgress,
  Actions: async (url, dest, _size) => {
    try {
      const { downloadTool } = await import("@actions/tool-cache");
      await downloadTool(url, dest);
    } catch (err) {
      throw new Error(`Download failed (outside actions environment?): {$err}`);
    }
  }
};
async function downloadWithProgress(url, dest, size) {
  const bar = createProgressBar();
  const fetch2 = fetchWithLogs("info");
  let abortController = null;
  const startTime = Date.now();
  let cleanupInProgress = false;
  const cleanup = async (reason) => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;
    if (abortController) {
      abortController.abort();
    }
    bar.fail(reason);
    fallibleToNull(async () => {
      await fs.promises.unlink(dest);
      logger2.debug("Cleaning up partial download file");
    });
  };
  const handleInterruption = async (signal) => {
    await cleanup(`Download interrupted by ${signal}`);
    process.exit(1);
  };
  process.on("SIGINT", () => handleInterruption("SIGINT"));
  process.on("SIGTERM", () => handleInterruption("SIGTERM"));
  logger2.debug(`Saving to: ${dest}`);
  try {
    abortController = new AbortController();
    const response = await fetch2(url, { signal: abortController.signal });
    if (!response.ok) {
      bar.fail(`Download failed: ${response.status} ${response.statusText}`);
      throw new Error("Download failed");
    }
    const totalSize = size ?? parseInt(response.headers.get("content-length") || "0", 10);
    if (totalSize == 0) {
      logger2.warn("Unknown file size, progress cannot be displayed");
      bar.setText("Downloading...");
    } else {
      logger2.info(`File size: ${humanReadableSize(totalSize)}`);
    }
    if (!response.body) {
      logger2.error("No response body returned!");
      throw new Error("Download failed");
    }
    ensureExists(path.dirname(dest));
    const responseStream = Readable.fromWeb(response.body);
    const fileStream = fs.createWriteStream(dest);
    let lastUpdate = Date.now();
    let downloadedSize = 0;
    responseStream.on("data", (chunk) => {
      downloadedSize += chunk.length;
      const now = Date.now();
      if (totalSize && (now - lastUpdate > 100 || downloadedSize === totalSize)) {
        lastUpdate = now;
        bar.update(downloadedSize, totalSize, now - startTime);
      }
    });
    await pipeline(responseStream, fileStream);
    const totalTime = ((Date.now() - startTime) / 1e3).toFixed(2);
    const avgDownloadSpeed = totalSize ? humanReadableSize(totalSize / parseFloat(totalTime)) + "/s" : "N/A";
    bar.success(`Download completed in ${totalTime}s (avg: ${avgDownloadSpeed})`);
    logger2.info(`Download completed successfully in ${totalTime}s`);
  } catch (err) {
    const error = err;
    bar.fail(`Download failed: ${error.message}`);
    if (error.name === "AbortError") await cleanup("Download aborted");
    await cleanup(error.message);
  } finally {
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
  }
}
function createProgressBar(barWidth = 30) {
  const interactive = isInteractive();
  const spinnerTransport = logger2.transports[0];
  const bar = spinnerTransport.setSpinner(
    ora({
      color: "cyan",
      prefixText: "info:    ",
      isEnabled: interactive,
      spinner: {
        frames: [""]
      }
    })
  ).start();
  let lastLoggedPercent = 0;
  return {
    success: (message) => {
      bar.stop();
      logger2.info(message);
    },
    fail: (message) => {
      bar.stop();
      logger2.error(message);
    },
    setText: (text) => bar.text = text,
    update: (downloadedSize, totalSize, msElapsed) => {
      const percent = Math.floor(downloadedSize / totalSize * 100);
      const downloaded = humanReadableSize(downloadedSize);
      const total = humanReadableSize(totalSize);
      const secsElapsed = (msElapsed / 1e3).toFixed(1);
      const speed = humanReadableSize(downloadedSize / (parseFloat(secsElapsed) || 1)) + "/s";
      if (!interactive) {
        if (percent >= lastLoggedPercent + 25 && percent < 100) {
          logger2.info(`Progress: ${percent}% (${downloaded}/${total}, ${speed})`);
          lastLoggedPercent = percent;
        }
      } else {
        const filled = Math.floor(percent / 100 * barWidth);
        const empty = barWidth - filled;
        const text = "\u2588".repeat(filled) + "\u2591".repeat(empty);
        const progressBar = `[${text}]`;
        bar.text = `${progressBar} ${percent}% | ${downloaded}/${total} | ${speed} | ${secsElapsed}s`;
      }
    }
  };
}

// src/index.ts
import { cacheDir, find } from "@actions/tool-cache";
import * as core from "@actions/core";
var tools = {
  pesde: { owner: "pesde-pkg", repo: "pesde" },
  lune: { owner: "lune-org", repo: "lune" }
};
var parentLogger = logging_default.child({ scope: "actions" });
parentLogger.exitOnError = true;
async function setupTool(repo, version) {
  const logger3 = parentLogger.child({ scope: "actions.setupTool" });
  let toolPath = find(repo.repo, version);
  if (toolPath == "") {
    toolPath = await new ToolManager(repo.owner, repo.repo).version(version).install(DownloadProvider.Actions).then((optionalPath) => optionalPath ? Promise.resolve(optionalPath) : Promise.reject("Download failed.")).catch((err) => void logger3.error(err)).then((binaryPath) => cacheDir(dirname(binaryPath), repo.repo, version));
  }
  core.addPath(toolPath);
}
var luneVersion = core.getInput("lune-version");
if (luneVersion !== "") await setupTool(tools.lune, luneVersion);
await setupTool(tools.pesde, core.getInput("version"));
