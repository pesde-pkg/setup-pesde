import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import ts from "typescript-eslint";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig([
	// base
	js.configs.recommended,
	ts.configs.recommended,

	// imports
	importPlugin.flatConfigs.recommended,
	importPlugin.flatConfigs.typescript,

	// prettier
	prettierRecommended,

	// custom
	{
		languageOptions: {
			globals: {
				...globals.node,
				...globals.commonjs
			},

			parser: tsParser,
			ecmaVersion: 2023,
			sourceType: "module"
		},

		settings: {
			"import/resolver": {
				typescript: {
					alwaysTryTypes: true,
					project: "./tsconfig.json"
				}
			}
		},

		rules: {
			"import/first": "error",
			"import/newline-after-import": "error",
			"import/no-duplicates": "error",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_"
				}
			]
		}
	}
]);
