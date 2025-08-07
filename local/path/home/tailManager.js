/** @param {NS} ns **/
export async function main(ns) {
	ns.disableLog("ALL");
	ns.ui.openTail();

	let action = null;

	while (true) {
		ns.clearLog();

		const linkStyle = { color: "#00BFFF", textDecoration: "underline", cursor: "pointer", marginRight: "15px" };

		const saveLink = React.createElement("a", { style: linkStyle, onClick: () => (action = "save") }, "[Save Layout]");
		const restoreLink = React.createElement("a", { style: linkStyle, onClick: () => (action = "restore") }, "[Restore Layout]");

		ns.printRaw(React.createElement("div", { style: { marginBottom: "10px" } }, saveLink, restoreLink));

		if (action) {
			if (action === "save") await saveLayout(ns);
			if (action === "restore") await restoreLayout(ns);
			action = null;
		}

		let count = 0;
		for (const p of ns.ps()) {
			const script = ns.getRunningScript(p.pid);
			if (script && script.tailProperties) {
				const props = script.tailProperties;
				const title = `${script.filename} ${script.args.join(" ")}`.trim();
				ns.print(title);
				ns.print(` ├ Pos: ${Math.round(props.x)},${Math.round(props.y)}\n ├ Size: ${Math.round(props.width)}x${Math.round(props.height)}\n ├ PID ${p.pid}\n`);
				count++;
			}
		}

		if (count === 0) {
			ns.print("No tailed scripts found.");
		}

		await ns.sleep(1000);
	}
}

/** @param {NS} ns **/
export async function saveLayout(ns) {
	const layout = [];
	for (const p of ns.ps()) {
		const script = ns.getRunningScript(p.pid);
		if (script && script.tailProperties) {
			layout.push({
				filename: script.filename,
				args: script.args,
				tail: script.tailProperties,
			});
		}
	}
	await ns.write("tail_layout.txt", JSON.stringify(layout, null, 2), "w");
	ns.toast(`Saved layout for ${layout.length} windows.`, "success");
}

/** @param {NS} ns **/
export async function restoreLayout(ns) {
	const filename = "tail_layout.txt";
	if (!ns.fileExists(filename)) {
		ns.toast(`Layout file not found!`, "error");
		return;
	}

	const savedLayout = JSON.parse(ns.read(filename));
	const runningScripts = ns.ps().map((p) => ({
		pid: p.pid,
		filename: p.filename,
		args: JSON.stringify(p.args),
	}));

	let restoredCount = 0;
	for (const saved of savedLayout) {
		const savedArgs = JSON.stringify(saved.args);
		const match = runningScripts.find((r) => r.filename === saved.filename && r.args === savedArgs);
		if (match) {
			ns.print(`Restored ${saved.filename} ${saved.tail.x},${saved.tail.y},${saved.tail.width}x${saved.tail.height}, pid: ${match.pid}`);
			ns.ui.moveTail(saved.tail.x, saved.tail.y, match.pid);
			ns.ui.resizeTail(saved.tail.width, saved.tail.height, match.pid);
			restoredCount++;
		}
	}

	ns.toast(`Restored layout for ${restoredCount} open windows.`, "info");
}

/** @param {NS} ns **/
export async function closeExtraTails(ns) {
	const filename = "tail_layout.txt";
	if (!ns.fileExists(filename)) {
		ns.toast("Layout file not found!", "warning");
		return;
	}

	const savedLayout = JSON.parse(ns.read(filename));
	const savedScriptKeys = new Set(savedLayout.map(s => `${s.filename}|${JSON.stringify(s.args)}`));

	let closedCount = 0;
	for (const p of ns.ps()) {
		const script = ns.getRunningScript(p.pid);
		if (script?.tailProperties) {
			const currentScriptKey = `${script.filename}|${JSON.stringify(script.args)}`;
			if (!savedScriptKeys.has(currentScriptKey)) {
				ns.ui.closeTail(p.pid);
				closedCount++;
			}
		}
	}
	ns.toast(`Closed ${closedCount} extra tail windows.`, "info");
}