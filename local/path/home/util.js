/** @param {NS} ns */
export const scanAll = (ns, start = "home") => {
	const seen = new Set(),
		stack = [start];
	while (stack.length) { 
		ns.scan(stack.pop())
		.forEach((n) => seen.has(n) || (stack.push(n), seen.add(n))); 
	}
	seen.add("home");
	return [...seen];
};

/** @param {NS} ns */
export function getScore(ns, server) {
	const moneyMax = ns.getServerMaxMoney(server);
	const secMin = ns.getServerMinSecurityLevel(server);
	const lvlneeded = ns.getServerRequiredHackingLevel(server);
	const time = (secMin * lvlneeded + 500) / (ns.getPlayer().skills.hacking + 50);
	const score = Math.sqrt(Math.sqrt((moneyMax * moneyMax) / time / 1000000000));
	return score;
}

/** @param {NS} ns */
export function getHosts(ns) {
	const all = scanAll(ns)
		.filter((s) => ns.hasRootAccess(s))
		.filter((s) => (ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()))
	return all;
}

/** @param {NS} ns */
export function getTargets(ns) {
	const purchased = new Set(ns.getPurchasedServers());
	const servers = scanAll(ns)
		.filter((s) => s !== "home" && !purchased.has(s) && ns.hasRootAccess(s))
		.filter((s) => ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel());
	return servers;
}

/** @param {NS} ns */
export function getScoredTargets(ns) {
	const servers = getTargets(ns).sort((a, b) => getScore(ns, b) - getScore(ns, a));
	return servers;
}

/** @param {NS} ns */
export function getPotentialTargets(ns) {
	const purchased = new Set(ns.getPurchasedServers());
	return scanAll(ns).filter(s => s !== "home" && !purchased.has(s));
}

/** @param {NS} ns */
export function getServerWeakenTime(ns, server) {
	const customServer = ns.getServer(server);
	customServer.baseDifficulty = ns.getServerMinSecurityLevel(server);
	const player = ns.getPlayer();
	const time = ns.formulas.hacking.weakenTime(customServer, player);
	return time;
}

/** @param {NS} ns */
export function copyFile(ns, files, destination) {
	for (const file of files) {
		ns.scp(file, destination, "home");
	}
}

/** @param {NS} ns */
export function killScript(ns, scripts, host) {
	for (const script of scripts) {
		if (ns.scriptRunning(script, host)) ns.scriptKill(script, host);
	}
}

/** @param {NS} ns */
export function formatRam(n) {
	if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(0)} EB`;
	if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} PB`;
	if (n >= 1024) return `${(n / 1024).toFixed(0)} TB`;
	return `${n.toFixed(0)} GB`;
}

/** @param {NS} ns */
export function formatMoney(n) {
	if (n === Infinity || isNaN(n)) return "N/A";
	if (n >= 1e15) return (n / 1e15).toFixed(1) + "q";
	if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
	if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
	if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
	if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
	return n.toFixed(1) + "0";
}

/** @param {NS} ns */
export function formatTime(n) {
	if (n === Infinity || isNaN(n)) return "∞";
	if (n < 60) return `${Math.floor(n)}s`;
	if (n < 3600) return `${Math.floor(n / 60)}m ${Math.floor(n % 60)}s`;
	const h = Math.floor(n / 3600);
	const m = Math.floor((n % 3600) / 60);
	const s = Math.floor(n % 60);
	return `${h}h ${m}m ${s}s`;
}

/** @param {NS} ns */
export const stockSymbols = {
	AERO: "aerocorp",
	APHE: "alpha-ent",
	BLD: "blade",
	CLRK: "clarkinc",
	CTK: "computek",
	CTYS: "catalyst",
	DCOMM: "defcomm",
	ECP: "ecorp",
	FLCM: "fulcrumtech",
	FNS: "foodnstuff",
	FSIG: "4sigma",
	GPH: "global-pharm",
	HLS: "helios",
	ICRS: "icarus",
	JGN: "joesguns",
	KGI: "kuai-gong",
	LXO: "lexo-corp",
	MDYN: "microdyne",
	MGCP: "megacorp",
	NTLK: "netlink",
	NVMD: "nova-med",
	OMGA: "omega-net",
	OMN: "omnia",
	OMTK: "omnitek",
	RHOC: "rho-construction",
	SGC: "sigma-cosmetics",
	SLRS: "solaris",
	STM: "stormtech",
	SYSC: "syscore",
	TITN: "titan-labs",
	UNV: "univ-energy",
	VITA: "vitalife",
	WDS: "",
};

/** @param {NS} ns */
export function getAllStocks(ns) {
	const commission = 100000;
	const symbols = ns.stock.getSymbols();

	return symbols.map(sym => {
		const pos = ns.stock.getPosition(sym);
		const stock = {
			sym: sym,
			longShares: pos[0],
			longPrice: pos[1],
			shortShares: pos[2],
			shortPrice: pos[3],
			forecast: ns.stock.getForecast(sym),
			volatility: ns.stock.getVolatility(sym),
			askPrice: ns.stock.getAskPrice(sym),
			bidPrice: ns.stock.getBidPrice(sym),
			maxShares: ns.stock.getMaxShares(sym),
		};

		const longProfit = stock.longShares * (stock.bidPrice - stock.longPrice) - (stock.longShares > 0 ? 2 * commission : 0);
		const shortProfit = stock.shortShares * (stock.shortPrice - stock.askPrice) - (stock.shortShares > 0 ? 2 * commission : 0);
		stock.profit = longProfit + shortProfit;
		stock.cost = (stock.longShares * stock.longPrice) + (stock.shortShares * stock.shortPrice);
		stock.profitPotential = (2 * Math.abs(stock.forecast - 0.5)) * stock.volatility;
		stock.summary = `${stock.sym}: ${stock.forecast.toFixed(3)} ± ${stock.volatility.toFixed(3)}`;

		return stock;
	});
}

/** @param {NS} ns */
export function rgbToAnsi256(r, g, b) {
	const to6cube = (c) => (c < 48 ? 0 : c < 114 ? 1 : Math.floor((c - 35) / 40));
	const r6 = to6cube(r);
	const g6 = to6cube(g);
	const b6 = to6cube(b);
	return 16 + 36 * r6 + 6 * g6 + b6;
}

export function hexToAnsi(hex) {
	if (!hex || hex.length !== 7) return "";
	const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((c) => parseInt(c, 16));
	const to6cube = (c) => (c < 48 ? 0 : c < 114 ? 1 : Math.floor((c - 35) / 40));
	const ansi = 16 + 36 * to6cube(r) + 6 * to6cube(g) + to6cube(b);
	return `\x1b[38;5;${ansi}m`;
}

/** @param {NS} ns */
export function interpolateColor(value, max, fromRGB, toRGB) {
	const ratio = Math.max(0, Math.min(1, value / max));
	const r = Math.round(fromRGB[0] + ratio * (toRGB[0] - fromRGB[0]));
	const g = Math.round(fromRGB[1] + ratio * (toRGB[1] - fromRGB[1]));
	const b = Math.round(fromRGB[2] + ratio * (toRGB[2] - fromRGB[2]));
	return rgbToAnsi256(r, g, b);
}

/** @param {NS} ns */
export function colorText(text, value, max) {
	const ansi = interpolateColor(value, max, [255, 0, 0], [0, 255, 0]);
	return `\x1b[38;5;${ansi}m${text}\x1b[0m`;
}

/** @param {NS} ns */
export function colorTextInv(text, value, max) {
	const ansi = interpolateColor(value, max, [0, 255, 0], [255, 0, 0]);
	return `\x1b[38;5;${ansi}m${text}\x1b[0m`;
}

