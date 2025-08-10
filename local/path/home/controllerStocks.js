import { getAllStocks, stockSymbols } from "./util.js";

const COMMISSION = 100000;
const MONEY_BUFFER = 10000 * COMMISSION;
const FORECAST_THRESHOLD = {
	BUY: 0.60,
	SELL: 0.50,
};

const SHORTING_ENABLED = false;
const GROW_WORKER = 'growStock.js';
const HACK_WORKER = 'hackStock.js';
const MANIPULATION_RAM_BUDGET = 0.33;

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();

	while (true) {
		ns.clearLog();
		await manageStocks(ns);
		await ns.sleep(500);
	}
}

/** @param {NS} ns */
async function manageStocks(ns) {
	const stocks = getAllStocks(ns);
	let portfolioValue = 0;
	let growTarget, hackTarget = null;

	for (const stock of stocks) {
		if (stock.longShares > 0 && stock.forecast < FORECAST_THRESHOLD.SELL) {
			sellPosition(ns, stock, 'long');
		}
		if (SHORTING_ENABLED && stock.shortShares > 0 && stock.forecast > FORECAST_THRESHOLD.SELL) {
			sellPosition(ns, stock, 'short');
		}
	}

	stocks.sort((a, b) => b.profitPotential - a.profitPotential);
	for (const stock of stocks) {
		const money = ns.getServerMoneyAvailable("home");
		if (money < MONEY_BUFFER) break;

		if (stock.forecast >= FORECAST_THRESHOLD.BUY) {
			buyPosition(ns, stock, 'long', money);
		}
		if (SHORTING_ENABLED && stock.forecast <= 1 - FORECAST_THRESHOLD.BUY) {
			buyPosition(ns, stock, 'short', money);
		}
	}

	for (const stock of getAllStocks(ns)) {
		portfolioValue += stock.cost + stock.profit;
		if (stock.longShares > 0) {
			ns.print(`${stock.summary} LONG ${ns.formatNumber(stock.cost + stock.profit, 3)} | P/L: ${ns.formatNumber(stock.profit, 3)}`);
			if (stock.forecast > FORECAST_THRESHOLD.SELL && (!growTarget || stock.forecast > growTarget.forecast)) {
				growTarget = stock;
			}
		}
		if (SHORTING_ENABLED && stock.shortShares > 0) {
			ns.print(`${stock.summary} SHORT ${ns.formatNumber(stock.cost + stock.profit, 3)} | P/L: ${ns.formatNumber(stock.profit, 3)}`);
			if (stock.forecast < FORECAST_THRESHOLD.SELL && (!hackTarget || stock.forecast < hackTarget.forecast)) {
				hackTarget = stock;
			}
		}
	}
	
	ns.print(`\nPortfolio Value: ${ns.formatNumber(portfolioValue, 3)}`);
	await manageManipulation(ns, growTarget, hackTarget);
}

/** @param {NS} ns */
function sellPosition(ns, stock, type) {
	const salePrice = type === 'long' ? ns.stock.sellStock(stock.sym, stock.longShares) : ns.stock.sellShort(stock.sym, stock.shortShares);
	if (salePrice > 0) {
		const profit = (type === 'long' ? stock.longShares * (salePrice - stock.longPrice) : stock.shortShares * (stock.shortPrice - salePrice)) - 2 * COMMISSION;
		ns.print(`SOLD ${type.toUpperCase()} ${stock.sym} for profit of ${ns.formatNumber(profit, 3)}`);
	}
}

/** @param {NS} ns */
function buyPosition(ns, stock, type, money) {
	const price = type === 'long' ? stock.askPrice : stock.bidPrice;
	const availableShares = stock.maxShares - stock.longShares - stock.shortShares;
	let sharesToBuy = Math.floor((money - MONEY_BUFFER) / price);
	sharesToBuy = Math.min(sharesToBuy, availableShares);

	if (sharesToBuy > 0) {
		const cost = type === 'long' ? ns.stock.buyStock(stock.sym, sharesToBuy) : ns.stock.short(stock.sym, sharesToBuy);
		if (cost > 0) {
			ns.print(`BOUGHT ${type.toUpperCase()} ${sharesToBuy} shares of ${stock.sym}`);
		}
	}
}

/** @param {NS} ns */
async function manageManipulation(ns, growTarget, hackTarget) {
	ns.scriptKill(GROW_WORKER, 'home');
	ns.scriptKill(HACK_WORKER, 'home');

	const freeRam = (ns.getServerMaxRam('home') - ns.getServerUsedRam('home')) * MANIPULATION_RAM_BUDGET;
	
	const growRam = growTarget ? ns.getScriptRam(GROW_WORKER) : 0;
	const hackRam = hackTarget ? ns.getScriptRam(HACK_WORKER) : 0;
	
	let growThreads = 0;
	let hackThreads = 0;

	if (growTarget && hackTarget) {
		growThreads = Math.floor((freeRam / 2) / growRam);
		hackThreads = Math.floor((freeRam / 2) / hackRam);
	} else if (growTarget) {
		growThreads = Math.floor(freeRam / growRam);
	} else if (hackTarget) {
		hackThreads = Math.floor(freeRam / hackRam);
	}

	if (growTarget && growThreads > 0) {
		const server = stockSymbols[growTarget.sym];
		ns.print(`Launching ${growThreads} grow threads for ${server}`);
		ns.exec(GROW_WORKER, 'home', growThreads, server);
	}
	
	if (hackTarget && hackThreads > 0) {
		const server = stockSymbols[hackTarget.sym];
		ns.print(`Launching ${hackThreads} hack threads for ${server}`);
		ns.exec(HACK_WORKER, 'home', hackThreads, server);
	}
}