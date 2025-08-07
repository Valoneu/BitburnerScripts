/** @param {NS} ns */
export async function main(ns) {
    const target = ns.args[0];
    if (!target) {
        ns.tprint("Error: No target specified.");
        return;
    }
    
    const maxMoney = ns.getServerMaxMoney(target);
    const minSecurity = ns.getServerMinSecurityLevel(target);

    while (true) {
        const currentMoney = ns.getServerMoneyAvailable(target);
        const currentSecurity = ns.getServerSecurityLevel(target);
        
        ns.clearLog();
        ns.print(`Target: ${target}`);
        ns.print(`Money: ${currentMoney.toFixed(2)} / ${maxMoney.toFixed(2)}`);
        ns.print(`Security: ${currentSecurity.toFixed(2)} / ${minSecurity.toFixed(2)}`);

        if (currentMoney < maxMoney * 0.95) {
            await ns.grow(target);
        } else if (currentSecurity > minSecurity * 1.05) {
            await ns.weaken(target);
        } else {
            await ns.hack(target);
        }
        
        await ns.sleep(100); // Yield to allow other scripts to run
    }
}