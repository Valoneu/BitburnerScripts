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
		"controllerBackdoor.js",
		"controllerContracts.js",
		"controllerHacknet.js",
		"controllerIpvgo.js",
		"controllerStocks.js",
		"scan-stats.js",
		"clickMap.js",
		"hud.js"
	];

	for (const script of scripts) {
		scriptStart(ns, script);
	}

	await ns.sleep(5000);

	await restoreLayout(ns);
	await closeExtraTails(ns);
}

/** @param {NS} ns */
function scriptStart(ns, script) {
	if (ns.scriptRunning(script, "home")) ns.scriptKill(script, "home");
	ns.print(`Starting ${script}...`);
	ns.run(script);
}