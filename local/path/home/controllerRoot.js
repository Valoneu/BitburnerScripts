import { getPotentialTargets } from "./util.js";

function findPath(ns, target) {
	const queue = [{ server: "home", path: ["home"] }];
	const visited = new Set(["home"]);

	while (queue.length > 0) {
		const { server, path } = queue.shift();
		if (server === target) return path;

		for (const neighbor of ns.scan(server)) {
			if (!visited.has(neighbor)) {
				visited.add(neighbor);
				queue.push({ server: neighbor, path: [...path, neighbor] });
			}
		}
	}
}

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
		const availableTools = crackTools.filter((tool) => ns.fileExists(tool.file, "home"));

		const targets = getPotentialTargets(ns)
			.map((server) => ns.getServer(server))
			.filter((server) => !server.hasAdminRights);

		for (const server of targets) {
			if (availableTools.length >= server.numOpenPortsRequired) {
				ns.print(`Attempting to root ${server.hostname}...`);

				availableTools.forEach((tool) => {
					try {
						tool.open(server.hostname);
					} catch {}
				});

				try {
					ns.nuke(server.hostname);
					ns.print(`SUCCESS: Gained root access on ${server.hostname}`);

					if (!server.backdoorInstalled && ns.getHackingLevel() >= server.requiredHackingLevel) {
						const path = findPath(ns, server.hostname);
						if (path) {
							ns.print(`INFO: Installing backdoor on ${server.hostname}...`);
							path.forEach((hop) => ns.singularity.connect(hop));
							await ns.singularity.installBackdoor();
							ns.singularity.connect("home");
							ns.print(`SUCCESS: Backdoor installed on ${server.hostname}`);
						}
					}
				} catch (e) {
					ns.print(`FAIL: Nuke failed on ${server.hostname}.`);
				}
			}
		}

		await ns.sleep(5000);
	}
}
