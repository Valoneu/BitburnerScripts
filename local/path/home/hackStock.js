/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    if (target && ns.hasRootAccess(target)) {
        await ns.hack(target, { stock: true });
    }
}