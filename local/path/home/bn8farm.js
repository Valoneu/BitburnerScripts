
/** @param {NS} ns */
export async function main(ns) {
  let iters = ns.args[0];
  for (let location of ['Chongqing', 'New Tokyo', 'Ishima']) {
    ns.singularity.travelToCity(location);
    let invs = ns.singularity.checkFactionInvitations();
    for (let inv of invs) {
      ns.singularity.joinFaction(inv)
    }
  }
  
  if (iters) {
    ns.atExit(() => ns.spawn('bn8_intfarm.js', {spawnDelay: 4}, iters-1));
    ns.singularity.softReset();
  } else {
    ns.write('times.txt', String(Date.now()), 'a');
  }
}