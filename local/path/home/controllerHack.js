import { copyFile, getHosts, getScoredTargets, formatMoney, formatRam, getServerWeakenTime, formatTime } from "./util.js";

const HACK = "hackShot.js";
const GROW = "growShot.js";
const WEAK = "weakShot.js";

var HACK_PERCENT = 0.95;
const OVERFILL = 1 + 0.5;
const BATCH_LIMIT = 90000;

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();
	
	while (true) {
		ns.clearLog();
		let hosts = getHosts(ns);

		var targets = getScoredTargets(ns).filter(s => getServerWeakenTime(ns, s) < (3 * 60 * 1000));
		let target = ns.getServer(targets[0]);
		ns.print(`Target: ${target.hostname}`);
		for (const host of hosts) {
			copyFile(ns, [HACK, GROW, WEAK], host);
		}

		let prepSec = ns.getServerSecurityLevel(target.hostname) <= (ns.getServerMinSecurityLevel(target.hostname) * 1.15);
		let prepMoney = ns.getServerMoneyAvailable(target.hostname) >= (ns.getServerMaxMoney(target.hostname) * 0.85);

		ns.print(`Min sec: ${ns.getServerMinSecurityLevel(target.hostname)} Sec: ${ns.getServerSecurityLevel(target.hostname)}`);
		ns.print(`Max: ${formatMoney(ns.getServerMaxMoney(target.hostname))} Avail: ${formatMoney(ns.getServerMoneyAvailable(target.hostname))}`);

		if (!(prepSec && prepMoney)) {
			await prepServer(ns, target.hostname, hosts);
		} else {
			await shootBatch(ns, target.hostname, hosts);
		}

		await ns.sleep(500);
	}
}

/** @param {NS} ns */
async function prepServer(ns, target, hosts) {
	ns.print(`Preparing server at ${target}`);
	
	let batchcount = 0;
	
	outer: for (const host of hosts) {
		let server = ns.getServer(host);

		var weakenTime = ns.getWeakenTime(target);
		var wThreads = Math.ceil((Math.max(1, Math.ceil((ns.getServerSecurityLevel(target) - ns.getServerMinSecurityLevel(target)) / ns.weakenAnalyze(1, server.cpuCores)))) / (BATCH_LIMIT / 1000));
		var gThreads = Math.ceil((Math.max(1, Math.ceil(ns.growthAnalyze(target, ns.getServerMaxMoney(target) / Math.max(1, ns.getServerMoneyAvailable(target)), server.cpuCores)))) / (BATCH_LIMIT / 1000));
		var wThreadsForGrow = (Math.ceil(ns.growthAnalyzeSecurity(gThreads) / ns.weakenAnalyze(1, server.cpuCores)));
		var batchRam = ns.getScriptRam(WEAK) * wThreads + ns.getScriptRam(GROW) * gThreads + ns.getScriptRam(WEAK) * wThreadsForGrow;

		let freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
		while (freeRam >= batchRam) {
			ns.exec(WEAK, host, wThreads, target, 0);
			ns.exec(GROW, host, gThreads, target, weakenTime - ns.getGrowTime(target));
			ns.exec(WEAK, host, wThreadsForGrow, target, 0);
			freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
			batchcount++;
			
			if (batchcount >= BATCH_LIMIT) break outer;
		}
	}
	ns.print(`Threads: w ${wThreads}, g ${gThreads}, w ${wThreadsForGrow} \nRam: ${formatRam(batchRam)} Time: ${formatTime(weakenTime/1000)}`);
	ns.print(`Batches: ${batchcount} Total Ram: ${formatRam(batchRam * batchcount)}`);
	ns.print(`All launched.`);
	await ns.sleep(weakenTime + 500);
}

/** @param {NS} ns */
async function shootBatch(ns, target, hosts) {
	ns.print(`Firing batch at ${target}`);
	
	let expectedmoney = 0;
	let batchcount = 0;
	
	outer: for (const host of hosts) {
		let server = ns.getServer(host);

		var weakenTime = ns.getWeakenTime(target);
		var hackThreads = Math.max(1, Math.floor(ns.hackAnalyzeThreads(target, ns.getServerMaxMoney(target) * HACK_PERCENT)));
		var weaken1Threads = Math.max(1, Math.ceil(ns.hackAnalyzeSecurity(hackThreads) / ns.weakenAnalyze(1, server.cpuCores)));
		var growThreads = Math.max(1, Math.ceil(ns.growthAnalyze(target, 1 / (1 - HACK_PERCENT)) * OVERFILL, server.cpuCores));
		var weaken2Threads = Math.max(1, Math.ceil((ns.growthAnalyzeSecurity(growThreads) / ns.weakenAnalyze(1, server.cpuCores)) * OVERFILL));
		var batchRam = ns.getScriptRam(HACK) * hackThreads + ns.getScriptRam(WEAK) * weaken1Threads + ns.getScriptRam(GROW) * growThreads + ns.getScriptRam(WEAK) * weaken2Threads;

		let freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
		while (freeRam >= batchRam) {
			ns.exec(HACK, host, hackThreads, target, weakenTime - ns.getHackTime(target));
			ns.exec(WEAK, host, weaken1Threads, target, 0);
			ns.exec(GROW, host, growThreads, target, weakenTime - ns.getGrowTime(target));
			ns.exec(WEAK, host, weaken2Threads, target, 0);
			freeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
			expectedmoney += ns.getServerMaxMoney(target) * HACK_PERCENT;
			batchcount++;
			
			if (batchcount >= BATCH_LIMIT) break outer;
		}
	}
	if ((batchcount == BATCH_LIMIT) && (HACK_PERCENT < 0.95)) HACK_PERCENT += 0.05;
	if ((batchcount < BATCH_LIMIT / 2) && (HACK_PERCENT > 0.05)) HACK_PERCENT -= 0.05;

	ns.print(`Threads: h ${hackThreads}, w ${weaken1Threads}, g ${growThreads}, w ${weaken2Threads} \nRam: ${formatRam(batchRam)} Time: ${formatTime(weakenTime/1000)}`);
	ns.print(`Money: ${formatMoney(expectedmoney)} Money/s: ${formatMoney(expectedmoney / weakenTime * 1000)} %: ${Math.round(HACK_PERCENT * 1000) / 1000}`);
	ns.print(`Batches: ${batchcount} Total Ram: ${formatRam(batchRam * batchcount)}`);
	await ns.sleep(weakenTime + 500);
}
