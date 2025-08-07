/** @param {NS} ns */
export async function main(ns) {
	while(true){
		ns.exec("share.js","home",1000);
		await ns.sleep(20);
	}
}