import { getScore, formatMoney, colorText, colorTextInv, getServerWeakenTime, getScoredTargets } from "./util.js";

/** @param {NS} ns */
export async function main(ns) {
	ns.ui.openTail();
	ns.disableLog("ALL");

	const widths = { server: 20, money: 17, sec: 13, lvl: 5, score: 6, time: 8 };

	const headers = [
		"Server".padEnd(widths.server),
		center("Money / M.Money", widths.money),
		center("Sec / Min S", widths.sec),
		center("Lvl", widths.lvl),
		center("Score", widths.score),
		center("W Time", widths.time)
	];

	const topbar = headers.join("│");
	const separator = Object.values(widths).map(w => "─".repeat(w)).join("┼");

	while (true) {
		ns.clearLog();
		const servers = getScoredTargets(ns).filter((s) => getScore(ns, s) > 0);

		ns.printf(topbar);
		ns.printf(separator);

		if (servers.length === 0) {
			await ns.sleep(1000);
			continue;
		}

		const bestServer = servers[0];
		const playerHackLvl = ns.getPlayer().skills.hacking;
		const bestServerScore = getScore(ns, bestServer);
		const bestServerMaxMoney = ns.getServerMaxMoney(bestServer);
		const bestServerMinSec = ns.getServerMinSecurityLevel(bestServer);

		for (const server of servers) {
			const money = ns.getServerMoneyAvailable(server);
			const moneyMax = ns.getServerMaxMoney(server);
			const sec = ns.getServerSecurityLevel(server);
			const secMin = ns.getServerMinSecurityLevel(server);
			const lvlNeeded = ns.getServerRequiredHackingLevel(server);
			const score = getScore(ns, server);
			const time = getServerWeakenTime(ns, server) / 1000;

			const moneyPart1 = colorText(formatMoney(money), money, moneyMax);
			const moneyPart2 = colorText(formatMoney(moneyMax), moneyMax, bestServerMaxMoney);
			const secPart1 = colorTextInv(sec.toFixed(1), sec, 100 - secMin);
			const secPart2 = colorTextInv(secMin.toFixed(1), secMin, bestServerMinSec);

			const cols = [
				server.padEnd(widths.server),
				padAroundSlash(moneyPart1, moneyPart2, widths.money),
				padAroundSlash(secPart1, secPart2, widths.sec),
				center(colorTextInv(lvlNeeded.toString(), lvlNeeded, playerHackLvl), widths.lvl),
				center(colorText(score.toFixed(0), score, bestServerScore), widths.score),
				center(colorTextInv(time.toFixed(1), time, 600), widths.time)
			];

			ns.printf(cols.join("│"));
		}
		await ns.sleep(1000);

	}
}

const stripColors = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

/** @param {NS} ns */
function center(text, width) {
	const visibleLength = stripColors(text).length;
	const padding = Math.max(0, width - visibleLength);
	const leftPad = Math.floor(padding / 2);
	const rightPad = padding - leftPad;
	return " ".repeat(leftPad) + text + " ".repeat(rightPad);
}

/** @param {NS} ns */
function padAroundSlash(part1, part2, totalWidth) {
	const p1Len = stripColors(part1).length;
	const p2Len = stripColors(part2).length;
	const spaceForParts = totalWidth - 3; // 3 for " / "
	const spaceForP1 = Math.floor(spaceForParts / 2);
	const spaceForP2 = spaceForParts - spaceForP1;

	const p1Padded = " ".repeat(spaceForP1 - p1Len) + part1;
	const p2Padded = part2 + " ".repeat(spaceForP2 - p2Len);
	
	return `${p1Padded} / ${p2Padded}`;
}