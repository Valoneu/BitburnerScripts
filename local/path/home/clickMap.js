/** @param {NS} ns */
export async function main(ns) {
	const excludePurchased = true;

	const corporationServers = new Set(["ecorp", "megacorp", "b-and-a", "blade", "nwo", "clarkinc", "omnitek", "4sigma", "kuai-gong", "fulcrumassets"]);
	const factionServers = new Set(["CSEC", "avmnite-02h", "I.I.I.I", "run4theh111z"]);

	function printServer(server, path, prefix = "", isLast = true) {
		const serverInfo = ns.getServer(server);

		let color = "#00ff00";
		if (server === "w0r1d_d43m0n" || server === "darkweb") color = "#ff4444";
		else if (serverInfo.purchasedByPlayer) color = "#aaccaa";
		else if (corporationServers.has(server)) color = "#00aaff";
		else if (factionServers.has(server)) color = "#fbff00ff";
		else if (!serverInfo.hasAdminRights) color = "#ff4444";

		const command = path.join("; connect ");
		const branch = prefix + (server === "home" ? "" : isLast ? "└" : "├");

		const clickableServer = React.createElement(
			"a",
			{
				style: { color, textDecoration: "underline", cursor: "pointer" },
				title: `Connect: ${command}`,
				onClick: () => {
					const terminalInput = document.getElementById("terminal-input");
					terminalInput.value = command;
					const handler = Object.keys(terminalInput).find((k) => k.startsWith("__reactProps$"));
					terminalInput[handler].onChange({ target: terminalInput });
				},
			},
			server
		);

		ns.printRaw(React.createElement("span", null, branch, clickableServer));

		let children = ns.scan(server).filter((child) => child !== path.at(-2));
		if (excludePurchased) {
			children = children.filter((s) => !ns.getServer(s).purchasedByPlayer);
		}

		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			const newPrefix = prefix + (server === "home" ? "" : isLast ? " " : "│");
			printServer(child, [...path, child], newPrefix, i === children.length - 1);
		}
	}
	ns.disableLog("ALL");
	ns.ui.openTail();
	while (true) {
		ns.clearLog();

		printServer("home", ["home"]);
    await ns.sleep(1000);
	}

}
