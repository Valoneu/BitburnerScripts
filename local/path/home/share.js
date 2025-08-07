/** @param {NS} ns */
export async function main(ns) {
	ns.ui.openTail();
	ns.disableLog("ALL");

	while (true) {
		await ns.share();
	}
}
