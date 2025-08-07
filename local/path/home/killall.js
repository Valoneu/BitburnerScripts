/** @param {NS} ns */
export async function main(ns) {
	ns.ui.openTail();
	ns.disableLog("ALL");
	ns.ui.clearTerminal();

	const servers = ns.getPurchasedServers();
	servers.push("home");
	for (const host of servers) {
		ns.tprintf(`Killing all processes on ${host}`);
		ns.scriptKill("hack.js", host);
		ns.scriptKill("weak.js", host);
		ns.scriptKill("grow.js", host);
		ns.scriptKill("hackShot.js", host);
		ns.scriptKill("growShot.js", host);
		ns.scriptKill("weakShot.js", host);

	}
}