/** @param {NS} ns */
export async function main(ns) {
  ns.killall(ns.args[0]);
  ns.deleteServer(ns.args[0]);
}