import { context } from "esbuild";
import { BitburnerPlugin } from "esbuild-bitburner-plugin";

const createContext = async () =>
	await context({
		entryPoints: ["servers/**/*.js", "servers/**/*.ts", "servers/**/*.tsx", "servers/**/*.jsx"],
		outbase: "./servers",
		outdir: "./build",
		plugins: [
			BitburnerPlugin({
				port: 12525,
				types: "NetscriptDefinitions.d.ts",
				mirror: {
					"local/path": ['home'],
				},
				distribute: {},
			}),
		],
		bundle: true,
		format: "esm",
		platform: "browser",
		logLevel: "debug",
	});

const ctx = await createContext();
ctx.watch();
