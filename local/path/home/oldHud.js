import { scanAll, getScore, getHosts } from "./util.js";

/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog("ALL");
	const doc = eval("document");

	const hook0 = doc.getElementById("overview-extra-hook-0");
	const hook1 = doc.getElementById("overview-extra-hook-1");

	const removeHUDElements = () => {
		doc.querySelectorAll(".HUD_el").forEach((e) => e.remove());
	};

	while (true) {
		try {
			const theme = ns.ui.getTheme();

			// --- Build a list of stats to display ---
			const stats = [];
			const player = ns.getPlayer();

			// Helper to add a stat to the list
			const addStat = (header, value, color) => stats.push({ header, value, color });

			// --- Player & General Info ---
			addStat("City", player.city, theme.cha);
			addStat("Location", player.location, theme.cha);

			let cumulativeIncome = 0;
			const Servers = getHosts(ns);
			for (let pserv of Servers) {
				for (var script of ns.ps(pserv)) {
					var s = ns.getRunningScript(script.pid);
					if (s && s.onlineRunningTime > 0) cumulativeIncome += s.onlineMoneyMade / s.onlineRunningTime;
				}
			}
			addStat("ScrInc", `$${ns.formatNumber(cumulativeIncome, 2)}/sec`, theme.money);
			addStat("ScrExp", `${ns.formatNumber(ns.getTotalScriptExpGain(), 2)} XP/sec`, theme.hack);

			// --- Network RAM ---
			let totalRam = 0, usedRam = 0;
			for (const server of Servers) {
				usedRam += ns.getServerUsedRam(server);
                totalRam += ns.getServerMaxRam(server);
			}
			addStat("Free RAM", `${ns.formatRam(totalRam - usedRam, 1)}`, theme.secondary);

			// --- Calculate Best Hack Target ---
			let bestTarget = "N/A",
				bestScore = 0;
			const purchasedSet = new Set(ns.getPurchasedServers());
			const servers = scanAll(ns).filter((s) => s !== "home" && !purchasedSet.has(s) && ns.hasRootAccess(s) && ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel());
			for (const server of servers) {
				let score = getScore(ns, server);
				if (score > bestScore) {
					bestTarget = server;
					bestScore = score;
				}
			}
			addStat("Target", bestTarget, theme.cha);

			// --- Singularity Stats (if available) ---
			try {
				if (ns.singularity.getOwnedAugmentations) {
					const installed = ns.singularity.getOwnedAugmentations(false).length;
					const purchased = ns.singularity.getOwnedAugmentations(true).length;
					addStat("Pending Augs", purchased - installed, theme.cha);
					addStat("Playtime", ns.tFormat(Date.now() - ns.singularity.getResetInfo().lastAugReset), theme.cha);
				}
			} catch {
				/* Singularity API not available */
			}

			// --- Stock Market Profit (if unlocked) ---
			try {
				if (ns.stock.hasWSEAccount && ns.stock.hasWSEAccount()) {
					let totalProfit = 0;
					for (const sym of ns.stock.getSymbols()) {
						const pos = ns.stock.getPosition(sym);
						if (pos[0] > 0) totalProfit += pos[0] * (ns.stock.getBidPrice(sym) - pos[1]);
						if (pos[2] > 0) totalProfit += pos[2] * (pos[3] - ns.stock.getAskPrice(sym));
					}
					const profitColor = totalProfit >= 0 ? theme.money : theme.hp;
					addStat("Stock Profit", `${totalProfit >= 0 ? "+" : ""}$${ns.formatNumber(totalProfit)}`, profitColor);
				}
			} catch {
				/* Stock API not available */
			}

			// --- Go Opponent (if in a game) ---
			try {
				const opponent = ns.go.getOpponent();
				if (opponent && opponent !== "No AI") {
					addStat("Go Opponent", opponent, theme.int);
				}
			} catch {
				/* Go API not available */
			}

			// --- Hacknet Info ---
			try {
				if (ns.hacknet.numNodes() > 0) {
					if (ns.hacknet.hashCapacity() > 0) {
						const current = ns.hacknet.numHashes();
						const capacity = ns.hacknet.hashCapacity();
						addStat("Hashes", `${ns.formatNumber(current, 2)} / ${ns.formatNumber(capacity, 2)}`, theme.secondary);
					} else {
						let production = 0;
						for (let i = 0; i < ns.hacknet.numNodes(); i++) production += ns.hacknet.getNodeStats(i).production;
						addStat("Hacknet", `$${ns.formatNumber(production, 2)}/sec`, theme.money);
					}
				}
			} catch {
				/* Hacknet API not available */
			}

			// --- Corporation Info ---
			try {
				if (ns.corporation.hasCorporation && ns.corporation.hasCorporation()) {
					const corp = ns.corporation.getCorporation();
					const profit = corp.revenue - corp.expenses;
					addStat("Corp Profit", `$${ns.formatNumber(profit, 2)}/sec`, theme.money);
				}
			} catch {
				/* Corporation API not available */
			}

			// --- Karma & Kills ---
			addStat("Karma", ns.formatNumber(ns.heart.break(), 1), theme.hp);
			addStat("Kills", player.numPeopleKilled, theme.hp);

			// --- Gang Info (if available) ---
			try {
				if (ns.gang.getGangInformation) {
					const gangInfo = ns.gang.getGangInformation();
					if (gangInfo) {
						addStat("Faction", gangInfo.faction, theme.int);
						addStat("Gang Resp", ns.formatNumber(gangInfo.respect), theme.int);
						addStat("Gang Inc", `$${ns.formatNumber(gangInfo.moneyGainRate * 5, 2)}/sec`, theme.money);
					}
				}
			} catch {
				/* Gang API not available */
			}

			// --- Render the stats ---
			removeHUDElements(); // Clear old stats

			for (const stat of stats) {
				// Create header
				const headerEl = `<span class="HUD_el" style="color: ${stat.color}">${stat.header}</span><br class="HUD_el">`;
				hook0.insertAdjacentHTML("beforeend", headerEl);
				// Create value
				const valueEl = `<span class="HUD_el" style="color: ${stat.color}">${stat.value}</span><br class="HUD_el">`;
				hook1.insertAdjacentHTML("beforeend", valueEl);
			}
		} catch (err) {
			ns.print("ERROR: Update Skipped: " + String(err));
		}

		// This is the key to making it disappear when the script is killed
		ns.atExit(removeHUDElements);
		await ns.sleep(1000 / (75 / 16));
	}
}