/** @param {NS} ns **/
export async function main(ns) {
  const maxRamUsage = 1024 * 32; // max total RAM you want all daemons to use
  const ramPerThread = ns.getScriptRam(ns.getScriptName());

  while (true) {
    // Count running copies of this script
    const pids = ns.ps().filter(p => p.filename === ns.getScriptName());
    const totalRamUsed = pids.length * ramPerThread;

    // If under maxRamUsage, spawn a new copy on this server
    if (totalRamUsed + ramPerThread <= maxRamUsage) {
      ns.exec(ns.getScriptName(), "home");
      ns.print(`Spawned new daemon. Total daemons: ${pids.length + 1}`);
    }

    // Sleep to let intelligence farm (longer sleep = more gains)
    await ns.sleep(60000);
  }
}
