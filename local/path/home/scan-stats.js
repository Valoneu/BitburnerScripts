import { getScore, formatMoney, colorText, colorTextInv, getServerWeakenTime, getScoredTargets } from "./util.js";

/** @param {NS} ns */
export async function main(ns) {
	ns.ui.openTail();
	ns.disableLog("ALL");
	ns.ui.clearTerminal();

	const servers = getScoredTargets(ns).filter(s => getScore(ns, s) > 0);

	const topbar = `${"Server".padEnd(20)} | ` + `${" Money".padStart(6)} / ${"M.Money".padEnd(7)} | ` + `${"Sec".padStart(5)} / ${"Min S".padEnd(5)} | ` + `${" Lvl".padStart(4)} | ` + `${"Score".padStart(5)} |` + `${"W Time".padStart(7)} |`;
	ns.tprintf("-".repeat(topbar.length));
	ns.tprintf(topbar);
	ns.tprintf("-".repeat(topbar.length));
		
	for (const server of servers) {
		const money = ns.getServerMoneyAvailable(server);
		const moneyMax = ns.getServerMaxMoney(server);
		const sec = ns.getServerSecurityLevel(server);
		const secMin = ns.getServerMinSecurityLevel(server);
		const lvlneeded = ns.getServerRequiredHackingLevel(server);
		const score = getScore(ns, server);
    const time = getServerWeakenTime(ns, server) / 1000;

		ns.tprintf(
			`${server.padEnd(20)} | ` +
			`${colorText(formatMoney(money).padStart(6), money, moneyMax)} / ${colorText(formatMoney(moneyMax).padEnd(7), moneyMax, ns.getServerMaxMoney(servers[0]))} | ` +
			`${colorTextInv(sec.toFixed(1).padStart(5), sec, 100 - secMin)} / ${colorTextInv(secMin.toFixed(1).padEnd(5), secMin, ns.getServerMinSecurityLevel(servers[0]))} | ` +
			`${colorTextInv(lvlneeded.toFixed(0).padStart(4), lvlneeded, ns.getPlayer().skills.hacking)} | ` +
			`${colorText(score.toFixed(0).padStart(5), score, getScore(ns, servers[0]))} |` +
			`${colorTextInv(time.toFixed(1).padStart(7), time, 600)} | `
		);
	}
}