import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: "esm",
	clean: true,
	minify: true,

	// make the ouput standalone (all dependencies bundled)
	bundle: true,
	noExternal: [/.*/],
	shims: true,
	banner: {
		js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
	}
});
