import { getHosts, getScoredTargets, formatMoney, copyFile } from "./util.js";

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();

	const HACK_SCRIPT = 'hack.js';
	const GROW_SCRIPT = 'grow.js';
	const WEAK_SCRIPT = 'weak.js';
	const workerScripts = [HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT];

	const secLvlThresh = 1.5;
	const moneyThresh = 0.75;
	while (true) {
		const hosts = getHosts(ns);
		const target = "n00dles";

		for (const host of hosts) {
			copyFile(ns, workerScripts, host);
		}
		ns.clearLog();
		ns.print(`Target: ${target}`);
		ns.print(`Money thrsh: ${formatMoney(ns.getServerMaxMoney(target) * moneyThresh).padStart(5)}`);
		ns.print(`Money avail: ${formatMoney(ns.getServerMoneyAvailable(target)).padStart(5)}`);
		ns.print(`Security thrsh: ${ns.getServerMinSecurityLevel(target) * secLvlThresh.toFixed(2).padStart(5)}`);
		ns.print(`Security level: ${ns.getServerSecurityLevel(target).toFixed(2).padStart(5)}`);

		for (const host of hosts) {
			const minSec = ns.getServerMinSecurityLevel(target);
			const maxMon = ns.getServerMaxMoney(target);

			let script;
			if (ns.getServerSecurityLevel(target) > minSec * secLvlThresh) {
				script = WEAK_SCRIPT;
			} else if (ns.getServerMoneyAvailable(target) < maxMon * moneyThresh) {
				script = GROW_SCRIPT;
			} else {
				script = HACK_SCRIPT;
			}

			const scriptRam = ns.getScriptRam(script);
			const freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
			const threads = Math.floor(freeRam / scriptRam);

			if (threads > 0) {
				ns.exec(script, host, threads, target);
			}
		}

		await ns.sleep(2000);
	}
}