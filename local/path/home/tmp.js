import { getHosts, getScoredTargets, getAllStocks } from "./util.js";

function hexToAnsi(hex) {
	if (!hex || hex.length !== 7) return "";
	const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((c) => parseInt(c, 16));
	const to6cube = (c) => (c < 48 ? 0 : c < 114 ? 1 : Math.floor((c - 35) / 40));
	const ansi = 16 + 36 * to6cube(r) + 6 * to6cube(g) + to6cube(b);
	return `\x1b[38;5;${ansi}m`;
}

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();

	while (true) {
		try {
			ns.clearLog();
			const player = ns.getPlayer();
			const theme = ns.ui.getTheme();
			const ansi = Object.entries(theme).reduce((acc, [key, val]) => ({ ...acc, [key]: hexToAnsi(val) }), {});
			ansi.reset = "\x1b[0m";

			const printRow = (header, value, hColor, vColor) => {
				const headerPadded = ` ${header}`.padEnd(14);
				const valuePadded = String(value).padStart(14);
				ns.print(`${hColor}${headerPadded}${ansi.reset}${vColor}${valuePadded}${ansi.reset}`);
			};

			// --- Top Panel ---
			printRow("HP", `${ns.formatNumber(player.hp.current, 0)} / ${ns.formatNumber(player.hp.max, 0)}`, ansi.hp, ansi.hp);
			printRow("Money", `$${ns.formatNumber(player.money, 3)}`, ansi.money, ansi.money);
			printRow("Hack", player.skills.hacking, ansi.hack, ansi.hack);
			printRow("Str", player.skills.strength, ansi.combat, ansi.combat);
			printRow("Def", player.skills.defense, ansi.combat, ansi.combat);
			printRow("Dex", player.skills.dexterity, ansi.combat, ansi.combat);
			printRow("Agi", player.skills.agility, ansi.combat, ansi.combat);
			printRow("Cha", player.skills.charisma, ansi.cha, ansi.cha);
			printRow("Int", player.skills.intelligence, ansi.int, ansi.int);

			// --- Bottom Panel ---
			const intBonus = (Math.pow(player.skills.intelligence, 0.8) / 500) * 100;
			printRow("Int Bonus", `+${intBonus.toFixed(4)}%`, ansi.int, ansi.int);
			printRow("City", player.city, ansi.cha, ansi.cha);
			printRow("Location", player.location, ansi.cha, ansi.cha);
			printRow("ScrInc", `$${ns.formatNumber(ns.getTotalScriptIncome()[0], 2)}/sec`, ansi.money, ansi.money);
			printRow("ScrExp", `${ns.formatNumber(ns.getTotalScriptExpGain(), 2)} XP/sec`, ansi.hack, ansi.hack);

			const hosts = getHosts(ns);
			const ram = hosts.reduce((a, h) => ({ u: a.u + ns.getServerUsedRam(h), t: a.t + ns.getServerMaxRam(h) }), { u: 0, t: 0 });
			printRow("Free RAM", ns.formatRam(ram.t - ram.u, 1), ansi.secondary, ansi.secondary);
			printRow("Target", getScoredTargets(ns)[0] || "N/A", ansi.cha, ansi.cha);

			try {
				if (ns.stock.hasWSEAccount()) {
					const profit = getAllStocks(ns).reduce((sum, s) => sum + s.profit, 0);
					const pColor = profit >= 0 ? ansi.money : ansi.hp;
					printRow("Stock Profit", `${profit >= 0 ? "+" : ""}$${ns.formatNumber(profit)}`, pColor, pColor);
				}
			} catch {}

			try {
				const opponent = ns.go.getOpponent();
				if (opponent && opponent !== "No AI") printRow("Go Opponent", opponent, ansi.int, ansi.int);
			} catch {}

			printRow("Karma", ns.formatNumber(ns.heart.break(), 1), ansi.hp, ansi.hp);
			printRow("Kills", player.numPeopleKilled, ansi.hp, ansi.hp);
		} catch (err) {
			ns.print(`ERROR: HUD update skipped: ${String(err)}`);
		}
		await ns.sleep(1000);
	}
}
