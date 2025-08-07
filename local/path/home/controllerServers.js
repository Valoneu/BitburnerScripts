import { formatRam } from "./util.js";

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();

	const budgetRatio = 0.9;
	const serverPrefix = "node";
	const sleepTime = 1000;

	while (true) {
		ns.clearLog();
		const money = ns.getPlayer().money;
		const servers = ns.getPurchasedServers();
		const maxServers = ns.getPurchasedServerLimit();
		const maxRam = ns.getPurchasedServerMaxRam();

		let targetRam = 0;
		for (let r = 2; r <= maxRam; r *= 2) {
			if (ns.getPurchasedServerCost(r) <= money * budgetRatio) {
				targetRam = r;
			} else {
				break;
			}
		}

		if (targetRam > 0) {
			if (servers.length < maxServers) {
				const cost = ns.getPurchasedServerCost(targetRam);
				if (money >= cost) {
					const name = `${serverPrefix}-${String(servers.length + 1).padStart(2, "0")}`;
					ns.purchaseServer(name, targetRam);
				}
			} else {
				const weakestServer = servers.map(s => ({ name: s, ram: ns.getServerMaxRam(s) }))
					.sort((a, b) => a.ram - b.ram)[0];

				if (weakestServer && weakestServer.ram < targetRam) {
					const cost = ns.getPurchasedServerUpgradeCost(weakestServer.name, targetRam);
					if (money >= cost) {
						ns.upgradePurchasedServer(weakestServer.name, targetRam);
					}
				}
			}
		}


		const currentServers = ns.getPurchasedServers();
		if (targetRam > 0) {
			const action = currentServers.length < maxServers ? "Buy" : "Upgrade";
			const cost = action === "Buy" 
				? ns.getPurchasedServerCost(targetRam) 
				: ns.getPurchasedServerUpgradeCost(
					currentServers.sort((a,b) => ns.getServerMaxRam(a) - ns.getServerMaxRam(b))[0],
					targetRam
				);
		} else {
		}
		
		const nodes = ["home", ...currentServers].sort();
		for (const host of nodes) {
			const ram = ns.getServerMaxRam(host);
			ns.printf(`${host.padStart(8)}| ${formatRam(ram).padEnd(6)}`);
		}

		await ns.sleep(sleepTime);
	}
}