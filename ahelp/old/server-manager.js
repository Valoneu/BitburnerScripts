/** @param {NS} ns */
export async function main(ns) {
	while (true) {
		const functionsToDisable = ['disableLog', 'scan', 'getServerRequiredHackingLevel', 'getServerMoneyAvailable', 'getServerMaxMoney', 'getServerSecurityLevel', 'getServerMinSecurityLevel', 'getServerNumPortsRequired', 'getServerMaxRam', 'getServerGrowth', 'getServerMaxRam', 'getHackingLevel', 'sleep', 'getHackTime', 'getGrowTime', 'getWeakenTime'];
		for (const func of functionsToDisable) {
			ns.disableLog(func);
		}

		while (ns.getPurchasedServers().length < 25) {
			ns.purchaseServer(`proxy-${ns.getPurchasedServers().length + 1}`, 16);
			await ns.sleep(100);
		}
		for (let server of ns.getPurchasedServers()) {
			if ((ns.getPurchasedServerUpgradeCost(server, ns.getServerMaxRam(server) * 2) <= ns.getServerMoneyAvailable("home")) && (ns.getServerMaxRam("proxy-25") == ns.getServerMaxRam(server))) {
				ns.upgradePurchasedServer(server, ns.getServerMaxRam(server) * 2);
				ns.print(`Upgraded server ${server} - ${ns.getServerMaxRam(server)} GB Ram`);
			}
		}

		await ns.sleep(100);
	}
}