/** @param {NS} ns **/
export async function main(ns) {
	const duration = ns.args[0] ?? 2000;
	const message = ns.args[1] ?? "CUSTOM POPUP.";

	const doc = eval("document");

	const overlay = doc.createElement("div");
	Object.assign(overlay.style, {
		position: "fixed",
		top: 0,
		left: 0,
		width: "100vw",
		height: "100vh",
		backgroundColor: "rgba(0,0,0,0.7)",
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		zIndex: 9999,
	});

	const popup = doc.createElement("div");
	Object.assign(popup.style, {
		backgroundColor: "#222",
		color: "#eee",
		padding: "20px 30px",
		borderRadius: "12px",
		fontSize: "18px",
		fontFamily: "Arial, sans-serif",
		boxShadow: "0 0 15px #0af",
		maxWidth: "400px",
		textAlign: "center",
	});
	popup.textContent = message;

	overlay.appendChild(popup);
	doc.body.appendChild(overlay);

	await ns.sleep(duration);
}
