/** @param {NS} ns */
let facServers = {
	"CSEC": "red",
	"avmnite-02h": "cyan",
	"I.I.I.I": "cyan",
	"run4theh111z": "cyan",
	"w0r1d_d43m0n": "red"
};

export async function main(ns) {
	let output = `<font color='lime'>Network:</font>`;
	let list = ["home"];
	let temp = [];
	let tempfiles = [];

	while (true) {
		await ns.sleep(1000)
		output = `<font color='lime'>Network:</font>`;
		for (var i = 0; i < list.length; i++) {
			temp = ns.scan(list[i]);
			for (var j = 0; j < temp.length; j++) {
				if (!list.includes(temp[j])) { list.push(temp[j]) }
			}
		}
		let order = [["home"]];
		let list1 = list.filter(item => item !== "home")
		let temp2 = [];
		let temp3 = [];
		while (list1.length > 0) {
			temp3 = order[order.length - 1];
			temp2 = [];
			for (i = 0; i < list1.length; i++) {
				for (j = 0; j < temp3.length; j++) {
					if (ns.scan(list1[i]).includes(temp3[j])) {
						temp2.push(list1[i]);
					}
				}
			}
			order.push(temp2);
			temp3 = order[order.length - 1];
			for (i = 0; i < list1.length; i++) {
				if (temp3.includes(list1[i])) {
					list1 = list1.filter(item => item !== list1[i]);
					i--;
				}

			}
		}
		let depthchart = "";
		for (i = 0; i < order.length; i++) {
			depthchart += "|" + i + "," + order[i].toString();
		}
		let depthlist = depthchart.split("|");
		depthlist.shift();
		for (i = 0; i < depthlist.length; i++) {
			depthlist[i] = depthlist[i].split(",");
		}

		for (i = 0; i < list.length; i++) {
			let name = list[i];
			let spacer = "-";
			let depth = 0;
			for (j = 0; j < depthlist.length; j++) {
				if (depthlist[j].includes(list[i])) {
					depth = depthlist[j][0];
				}
			}
			let steps = [list[i]]
			while (depth > 0) {
				depth--
				for (j = 0; j < steps.length; j++) {
					let temp = ns.scan(steps[j]);
					for (let k = 0; k < temp.length; k++) {
						if (depthlist[depth].includes(temp[k])) {
							steps.push(temp[k]);
							k = temp.length;
						}
					}
				}
			}
			steps.reverse();
			let goto = ""
			for (j = 0; j < steps.length; j++) {
				goto += ";connect " + steps[j];
			}

			let hackColor = ns.hasRootAccess(name) ? "lime" : "red";


			let nameColor = facServers[name] ? facServers[name] : "white";
			if (nameColor == "white") {
				let ratio = ns.getServerSecurityLevel(name) / ns.getServerMinSecurityLevel(name);

				if (ratio > 3) {
					nameColor = "Red";
				}
				else if (ratio > 2) {
					nameColor = "orange";
				}
				else if (ratio > 1) {
					nameColor = "green";
				}
				else nameColor = "lime";
			}
			if (ns.getServerRequiredHackingLevel(name) > ns.getHackingLevel()) {
				nameColor = "darkRed"
			}
			let hoverText = ["Req Level: ", ns.getServerRequiredHackingLevel(name),
				"&#10;Req Ports: ", ns.getServerNumPortsRequired(name),
				"&#10;Memory: ", ns.getServerMaxRam(name), "GB",
				"&#10;Security: ", ns.getServerSecurityLevel(name),
				"/", ns.getServerMinSecurityLevel(name),
				"&#10;Money: ", Math.round(ns.getServerMoneyAvailable(name)).toLocaleString(), " (",
				Math.round(100 * ns.getServerMoneyAvailable(name) / ns.getServerMaxMoney(name)), "%)"
			].join("");

			let ctText = "";


			tempfiles = ns.ls(name, ".cct");
			for (j = 0; j < tempfiles.length; j++) {
				ctText += "<a title='" + tempfiles[j] +
					//Comment out the next line to reduce footprint by 5 GB
					"&#10;" + ns.codingcontract.getContractType(tempfiles[j], name) +
					"'>©</a>";
			}
			while ((name.length + spacer.length + tempfiles.length) < 20) {
				spacer += "-";
			}
			let monratio = ns.getServerMoneyAvailable(name) / ns.getServerMaxMoney(name);
			let money = " "
			money += ns.formatNumber(ns.getServerMoneyAvailable(name)) + " (";
			if (Math.round(100 * monratio) != 'Infinity') {
				money += Math.round(100 * ns.getServerMoneyAvailable(name) / ns.getServerMaxMoney(name)) + "%)";
			}
			else { money += "∞%)"; }

			let moneyColor = "red";
			if (monratio > 0.1) {
				moneyColor = "orange";
			}
			if (monratio > 0.6) {
				moneyColor = "yellow";
			}
			if (monratio > 0.9) {
				moneyColor = "lime";
			}
			output += '<br>' + `<tt>----<font color=${hackColor}>■ </font>` +

				`<a class='scan-analyze-link' title='${hoverText}''
      onClick="(function()
          {
              const terminalInput = document.getElementById('terminal-input');
              terminalInput.value='${goto}';
              const handler = Object.keys(terminalInput)[1];
              terminalInput[handler].onChange({target:terminalInput});
              terminalInput[handler].onKeyDown({key:'Enter',preventDefault:()=>null});
          })();"

          style='color:${nameColor}'>${name}</a> ` +
				`<font color='fuchisa'>${ctText}</font>` + `<font color="black">${spacer}</font>` +
				`<font color='${moneyColor}'>${money}</font></tt>`;


		}

		const doc = eval('document');
		const HUDElement = doc.getElementById("root").firstChild.nextSibling.firstChild.nextSibling.firstChild;
		try {
			if (HUDElement.firstChild.innerHTML.includes('<li')) {
				try {
					const lista = doc.getElementById("hook");
					lista.innerHTML = output;
				}
				catch {
					HUDElement.insertAdjacentHTML('beforeEnd', `<ul class="MuiList-root jss26 MuiList-padding css-1ontqvh" style="width:25%;  overflow-y: scroll; overflow-x: scroll;" id="hook"><li class="MuiListItem-root jss24 MuiListItem-gutters MuiListItem-padding css-1578zj2 " style="overflow-y: scroll; overflow-x: scroll;"><div class="MuiTypography-root jss29 MuiTypography-body1 css-cxl1tz"><span>Bitburner v2.5.0 (b87b8b4be)</span></div></li></ul>`)
					const lista = doc.getElementById("hook");
					lista.innerHTML = output;

				}
			}
		}
		catch { }
	}
}