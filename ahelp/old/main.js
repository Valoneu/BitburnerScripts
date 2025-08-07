/** @param {NS} ns */
export async function main(ns) {
	ns.exec("scan.js", "home");
	ns.tail("scan.js")
	ns.exec("find-and-solve.js", "home");
	ns.tail("find-and-solve.js")
	ns.exec("overview.js", "home");
	ns.tail("overview.js")
	ns.exec("server-manager.js", "home");
	ns.tail("server-manager.js")
	ns.exec("attack.js", "home");
	ns.tail("attack.js")
	ns.exec("controller.js", "home");
	ns.tail("controller.js")
	ns.exec("share.js", "home", Math.floor((ns.getServerMaxRam("home")*0.1)/ns.getScriptRam("share.js")));
	ns.tail("share.js")
	ns.exec("stock.js", "home");
	ns.tail("stock.js")
	ns.exec("infiltrate.js","home")
}