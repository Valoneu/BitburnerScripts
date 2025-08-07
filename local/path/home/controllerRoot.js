import { getPotentialTargets } from "./util.js";

/** @param {NS} ns */
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();

	const crackTools = [
		{ file: "BruteSSH.exe", open: ns.brutessh },
		{ file: "FTPCrack.exe", open: ns.ftpcrack },
		{ file: "relaySMTP.exe", open: ns.relaysmtp },
		{ file: "HTTPWorm.exe", open: ns.httpworm },
		{ file: "SQLInject.exe", open: ns.sqlinject },
	];

	while (true) {
		const availableTools = crackTools.filter(tool => ns.fileExists(tool.file, "home"));

		const targets = getPotentialTargets(ns)
			.filter(server => !ns.hasRootAccess(server));

		for (const server of targets) {
			const requiredPorts = ns.getServerNumPortsRequired(server);

			if (availableTools.length >= requiredPorts) {
				ns.print(`Attempting to root ${server}...`);

				availableTools.forEach(tool => {
					try { tool.open(server); } catch { }
				});

				try {
					ns.nuke(server);
					ns.print(`SUCCESS: Gained root access on ${server}`);
				} catch (e) {
					ns.print(`FAIL: Could not nuke ${server}. Hacking level likely too low.`);
				}
			}
		}

		await ns.sleep(1000);
	}
}