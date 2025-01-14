import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default {
	input: "./src/registerPlugin.ts",
	output: {
		file: "./dist/RideVehicleEditor.js", // CHANGE THIS TO YOUR OPENRCT2 PLUGIN FOLDER FOR HOT RELOAD
		// TO IGNORE GIT CHANGES ON THIS FILE: git update-index --skip-worktree rollup.config.dev.js
		// TO ACCEPT GIT CHANGES ON THIS FILE AGAIN: git update-index --no-skip-worktree rollup.config.dev.js
		format: "iife",
	},
	plugins: [
		replace({
			include: "./src/environment.ts",
			preventAssignment: true,
			values: {
				__BUILD_CONFIGURATION__: JSON.stringify("development")
			}
		}),
		typescript(),
		terser({
			format: {
				quote_style: 1,
				wrap_iife: true,
				preamble: "// Get the latest version: https://github.com/Basssiiie/OpenRCT2-RideVehicleEditor",

				beautify: true
			},
			mangle: {
				properties: {
					regex: /^_/
				}
			},

			// Useful only for stacktraces:
			keep_fnames: true,
		}),
	],
};
