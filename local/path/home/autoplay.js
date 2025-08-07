import { closeExtraTails, restoreLayout } from "./tailManager";

/** @param {NS} ns */
export async function main(ns) {
	ns.ui.openTail();
	ns.disableLog("ALL");

	const scripts = [
		"kill-all.js",
		"controllerRoot.js", 
		"controllerServers.js", 
		"controllerHack.js",
		"controllerContracts.js",
		"controllerHacknet.js",
		"controllerIpvgo.js",
		"controllerStocks.js",
		"scan-stats.js",
		"hud.js"
	];

	for (const script of scripts) {
		scriptStart(ns, script);
	}

	restoreLayout(ns);
	closeExtraTails(ns);
}

/** @param {NS} ns */
function scriptStart(ns, script) {
	if (ns.scriptRunning(script, "home")) ns.scriptKill(script, "home");
	ns.print(`Starting ${script}...`);
	ns.run(script);
}