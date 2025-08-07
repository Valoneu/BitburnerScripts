import { formatMoney, formatTime } from "util.js";

/** @param {NS} ns */
export async function main(ns) {
	const budgetRatio = 0.1;
	const sleepTime = 20;

	ns.disableLog("ALL");
	ns.ui.openTail();
	
	let getProd;
	const player = ns.getPlayer();
	const hasFormulas = ns.fileExists("Formulas.exe", "home");

	if (hasFormulas) {
		getProd = (level, ram, cores) =>
			ns.formulas.hacknetServers.hashGainRate(level, ram, cores, player.mults.hacknet_node_money);
		ns.print("INFO: Using Formulas.exe for precise calculations.");
	} else {
		getProd = (level, ram, cores) => {
			const levelMult = level * 1.5;
			const ramMult = Math.pow(1.035, ram - 1);
			const coresMult = (cores + 5) / 6;
			return levelMult * ramMult * coresMult * player.mults.hacknet_node_money;
		};
		ns.print("WARN: Formulas.exe not found. Using fallback calculation.");
		ns.print("      ROI calculations may be slightly less accurate.");
	}
	await ns.sleep(200);

	while (true) {
		const budget = ns.getServerMoneyAvailable("home") * budgetRatio;
		let bestUpgrade = { type: "None", cost: Infinity, roi: Infinity };

		const nodeCount = ns.hacknet.numNodes();

		for (let i = 0; i < nodeCount; i++) {
			const stats = ns.hacknet.getNodeStats(i);
			const currentProd = getProd(stats.level, stats.ram, stats.cores);

			const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
			const levelProdGain = getProd(stats.level + 1, stats.ram, stats.cores) - currentProd;
			if (levelProdGain > 0) {
				const roi = levelCost / levelProdGain;
				if (roi < bestUpgrade.roi) {
					bestUpgrade = { type: "Level", node: i, cost: levelCost, roi };
				}
			}

			const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
			const ramProdGain = getProd(stats.level, stats.ram * 2, stats.cores) - currentProd;
			if (ramProdGain > 0) {
				const roi = ramCost / ramProdGain;
				if (roi < bestUpgrade.roi) {
					bestUpgrade = { type: "RAM", node: i, cost: ramCost, roi };
				}
			}

			const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
			const coreProdGain = getProd(stats.level, stats.ram, stats.cores + 1) - currentProd;
			if (coreProdGain > 0) {
				const roi = coreCost / coreProdGain;
				if (roi < bestUpgrade.roi) {
					bestUpgrade = { type: "Core", node: i, cost: coreCost, roi };
				}
			}
		}

		if (nodeCount < ns.hacknet.maxNumNodes()) {
			const newNodeCost = ns.hacknet.getPurchaseNodeCost();
			const newNodeProd = getProd(1, 1, 1);
			if (newNodeProd > 0) {
				const roi = newNodeCost / newNodeProd;
				if (roi < bestUpgrade.roi) {
					bestUpgrade = { type: "Node", cost: newNodeCost, roi };
				}
			}
		}

		ns.clearLog();
		ns.print(`Current Budget: ${formatMoney(ns, budget)}`);
		ns.print("--------------------------------");

		if (bestUpgrade.type !== "None" && bestUpgrade.cost !== Infinity) {
			ns.print(`Best Upgrade: ${bestUpgrade.type} ${bestUpgrade.type.match(/Level|RAM|Core/) ? `on Node ${bestUpgrade.node}` : ""}`);
			ns.print(`Cost:         ${formatMoney(ns, bestUpgrade.cost)}`);
			ns.print(`Payback Time: ${formatTime(ns, bestUpgrade.roi)}`);

			if (bestUpgrade.cost <= budget) {
				let success = false;
				switch (bestUpgrade.type) {
					case "Level": success = ns.hacknet.upgradeLevel(bestUpgrade.node, 1); break;
					case "RAM":   success = ns.hacknet.upgradeRam(bestUpgrade.node, 1); break;
					case "Core":  success = ns.hacknet.upgradeCore(bestUpgrade.node, 1); break;
					case "Node":  success = (ns.hacknet.purchaseNode() !== -1); break;
				}
				if (success) {
					ns.print(`\nSUCCESS: Purchased ${bestUpgrade.type} upgrade.`);
					await ns.sleep(sleepTime + 500);
				}
			} else {
				ns.print(`\nWaiting for funds. Need ${formatMoney(ns, bestUpgrade.cost)}.`);
			}
		} else {
			ns.print("All hacknet components are maxed out!");
		}

		await ns.sleep(sleepTime);
	}
}