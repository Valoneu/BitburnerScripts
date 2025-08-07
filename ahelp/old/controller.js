/**
Pick a hack thread number
Calculate the required grow threads to offset with growthAnalyze
Calculate weaken to offset hack and grow (hack is +0.002, grow is +0.004, weaken is -0.05) 

    const colors = [
        '\x1b[38;5;196m', // red
        '\x1b[38;5;202m',
        '\x1b[38;5;208m',
        '\x1b[38;5;214m',
        '\x1b[38;5;220m',
        '\x1b[38;5;226m', // yellow
        '\x1b[38;5;190m',
        '\x1b[38;5;154m',
        '\x1b[38;5;118m',
        '\x1b[38;5;82m',  // green
        '\x1b[38;5;46m'   // green
    ];

    const reset = '\x1b[0m';
    const text = 'Color Gradient';

    for (let color of colors) {
        ns.print(`${color}${text}${reset}`);
    };
*/

let lastTarget = "";
let targetPrepped = 0;

/** @param {NS} ns */
export async function main(ns) {
  ns.clearLog();
  const functionsToDisable = ['disableLog', 'scan', 'getServerRequiredHackingLevel', 'getServerMoneyAvailable', 'getServerMaxMoney', 'getServerSecurityLevel', 'getServerMinSecurityLevel', 'getServerNumPortsRequired', 'getServerMaxRam', 'getServerGrowth', 'getServerMaxRam', 'getHackingLevel', 'sleep', 'getHackTime', 'getGrowTime', 'getWeakenTime', 'getServerUsedRam', 'exec', 'scp', 'brutessh', 'ftpcrack', 'relaysmtp', 'httpworm', 'sqlinject', 'nuke'];
  for (const func of functionsToDisable) { ns.disableLog(func); }
  while (true) {
    ns.clearLog();


    const allServers = scanAllServers(ns, "home");
    let hackableServers = allServers.filter(server => ns.getServerRequiredHackingLevel(server) <= ns.getHackingLevel());
    //let megacorps = ["foodnstuff"];
    //let megacorps = ["blade"];
    //let megacorps = hackableServers.filter(server => 700000000000 <= ns.getServerMaxMoney(server));
    //let megacorps = hackableServers.filter(server => 10000000000 <= ns.getServerMaxMoney(server));
    let megacorps = hackableServers.filter(server => 100000000 <= ns.getServerMaxMoney(server));
    megacorps = megacorps.filter(server => ns.hasRootAccess(server));

    megacorps.sort((a, b) => {
      const maxMoneyA = ns.getServerMaxMoney(a);
      const maxMoneyB = ns.getServerMaxMoney(b);
      return maxMoneyB - maxMoneyA;
    });

    hackAllServers(ns, hackableServers);
    for (let i = 0; i <= 25; i++) {
      for (let target of megacorps) {

        //target = findTarget(ns, hackableServers);
        ns.printf(`INFO: Current target: ${target}`);

        let threads = calculateThreads(ns, target);
        ns.print('INFO: Thread balance: H: ' + threads[0] + ' G: ' + threads[1] + ' W: ' + threads[2]);

        let boughtServers = getBoughtServers(ns, allServers);
        boughtServers.push("home");

        //if (targetPrepped == 0) { await prepareTarget(ns, threads, target) };

        //if (targetPrepped == 1) { await executeScripts(ns, boughtServers, threads, target) };


        executeScripts(ns, boughtServers, threads, target)
      }
    }

    await ns.sleep(1);
    //await ns.sleep(ns.getWeakenTime(target) / 5000);
  }
}

/** @param {NS} ns */
async function prepareTarget(ns, threads, target) {
  let serverMinSecurityLevel = ns.getServerMinSecurityLevel(target);
  let serverSecurityLevel = ns.getServerSecurityLevel(target);
  let serverMaxMoney = ns.getServerMaxMoney(target);
  let serverMoney = ns.getServerMoneyAvailable(target);
  while (serverSecurityLevel >= serverMinSecurityLevel * 0.8 || serverMaxMoney * 0.8 <= serverMoney) {
    if (serverMaxMoney * 0.8 <= serverMoney) {
      while (ns.getServerMaxRam("home") - ns.getServerUsedRam("home") > ns.getScriptRam("grow.js") + ns.getScriptRam("weaken.js")) {
        ns.exec("grow.js", "home", 1, target, 20);
        ns.print(`prepping growing`);
        await ns.sleep(200);
      }
    }
    if (serverSecurityLevel >= serverMinSecurityLevel * 0.8) {
      while (ns.getServerMaxRam("home") - ns.getServerUsedRam("home") > ns.getScriptRam("grow.js") + ns.getScriptRam("weaken.js")) {
        ns.exec("weaken.js", "home", 1, target, 20);
        ns.print(`prepping weakening`);
        await ns.sleep(200);
      }
    }
    await ns.sleep(20);
  }
  if (serverSecurityLevel <= serverMinSecurityLevel * 0.8 || serverMaxMoney * 0.8 >= serverMoney) {
    targetPrepped = 1;
    ns.print(`prepping done`);
  }
}

/** @param {NS} ns */
function executeScripts(ns, boughtServers, threads, target) {
  for (let server of boughtServers) {
    let scriptRam = (ns.getScriptRam("hack.js") * threads[0] + ns.getScriptRam("grow.js") * threads[1] + ns.getScriptRam("weaken.js") * threads[2]);
    let freeRam = (ns.getServerMaxRam(server) - ns.getServerUsedRam(server));
    if (freeRam > scriptRam) {
      let weakenTime = ns.getWeakenTime(target);
      let hackTime = ns.getHackTime(target);
      let growTime = ns.getGrowTime(target);

      ns.scp(["hack.js", "grow.js", "weaken.js"], server, "home");

      ns.exec("hack.js", server, threads[0], target, weakenTime - hackTime);
      ns.print(`hack.js, ${server}, threads ${threads[0]}, ${((weakenTime - hackTime).toFixed(0)) / 1000} sec, ${weakenTime.toFixed(0) / 1000} sec`);
      ns.exec("grow.js", server, threads[1], target, weakenTime - growTime);
      ns.print(`grow.js, ${server}, threads ${threads[1]}, ${((weakenTime - growTime).toFixed(0)) / 1000} sec, ${weakenTime.toFixed(0) / 1000} sec`);
      ns.exec("weaken.js", server, threads[2], target, 0);
      ns.print(`weaken.js, ${server}, threads ${threads[2]}, ${(weakenTime.toFixed(0)) / 1000} sec, ${weakenTime.toFixed(0) / 1000} sec`);

      ns.print(`Executed scripts on ${server}`);
    } else {
      //ns.print(`Insufficient RAM on ${server} to execute scripts`);
    }
  }
}

/** @param {NS} ns */
function getBoughtServers(ns, allServers) {
  const boughtServerPrefix = "proxy-";
  const boughtServers = allServers.filter(server => server.startsWith(boughtServerPrefix));
  return boughtServers;
}

/** @param {NS} ns */
function calculateThreads(ns, target) {

  let player = ns.getPlayer();
  let server = ns.getServer(target);
  let percent = 0.25;

  server.hackDifficulty = server.minDifficulty;
  server.moneyAvailable = server.moneyMax;

  // hack calculations
  //const hackPercentThread = 0.01;
  const hackPercentThread = ns.formulas.hacking.hackPercent(server, player);
  const hackThreads = Math.floor(percent / hackPercentThread);
  const effectivePercent = hackPercentThread * hackThreads;
  const batchMoney = server.moneyAvailable * effectivePercent;
  const hackRam = ns.getScriptRam('hack.js');

  // grow calculations
  server.moneyAvailable -= batchMoney;
  server.hackDifficulty += hackThreads * 0.002;
  //const grwThreads = 10;
  const grwThreads = Math.ceil(ns.formulas.hacking.growThreads(server, player, server.moneyMax) * 1.25);
  const grwRam = ns.getScriptRam('grow.js');

  // weaken calculations
  const wThreads = Math.ceil(((hackThreads * 0.002 + grwThreads * 0.004) / 0.05) * 1.5);
  const weakenRam = ns.getScriptRam('weaken.js');
  const batchRam = hackRam + grwRam + weakenRam;

  return [hackThreads, grwThreads, wThreads];
}

/** @param {NS} ns */
function findTarget(ns, hackableServers) {
  let target = "";
  let bestscore = 0;
  hackableServers = hackableServers.filter(server => ns.hasRootAccess(server) == true);
  for (let server of hackableServers) {
    let score = getScore(ns, server)
    if (score >= bestscore) {
      bestscore = score;
      target = server;
    }
    //ns.printf(`${score.toFixed(2)}, ${bestscore.toFixed(2)}, ${server}`);
  }
  if (target != lastTarget) { targetPrepped = 0; lastTarget = target; }
  return target;
}

/** @param {NS} ns */
function getScore(ns, server) {

  const maxMoney = ns.getServerMaxMoney(server);
  const growRate = ns.getServerGrowth(server);
  const growTime = ns.getGrowTime(server);
  const weakTime = ns.getWeakenTime(server);
  let score = 0;
  if (maxMoney != 0) {
    score = (maxMoney * 0.25 / growRate * growTime - 5 * weakTime)
  }
  else { score = 0 }

  return score;
}

/** @param {NS} ns */
function hackAllServers(ns, hackableServers) {
  for (const server of hackableServers) {
    if (server === 'home') continue;
    if (ns.hasRootAccess(server)) continue;

    const requiredPorts = ns.getServerNumPortsRequired(server);
    let openPorts = 0;

    if (ns.fileExists("BruteSSH.exe", "home")) {
      ns.brutessh(server);
      openPorts++;
    }
    if (ns.fileExists("FTPCrack.exe", "home")) {
      ns.ftpcrack(server);
      openPorts++;
    }
    if (ns.fileExists("relaySMTP.exe", "home")) {
      ns.relaysmtp(server);
      openPorts++;
    }
    if (ns.fileExists("HTTPWorm.exe", "home")) {
      ns.httpworm(server);
      openPorts++;
    }
    if (ns.fileExists("SQLInject.exe", "home")) {
      ns.sqlinject(server);
      openPorts++;
    }
    if (openPorts >= requiredPorts && !ns.hasRootAccess(server)) {
      ns.nuke(server);
    }
  }
}

/** @param {NS} ns */
function scanAllServers(ns, startServer) {
  const visited = new Set();
  const stack = [startServer];
  const allServers = [];

  while (stack.length > 0) {
    const server = stack.pop();
    if (!visited.has(server)) {
      visited.add(server);
      allServers.push(server);
      const connectedServers = ns.scan(server);
      for (const connectedServer of connectedServers) {
        if (!visited.has(connectedServer)) {
          stack.push(connectedServer);
        }
      }
    }
  }
  return allServers;
}