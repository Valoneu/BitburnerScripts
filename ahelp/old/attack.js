const hhack = "take.js";

/** @param {NS} ns */
export async function main(ns) {
   while (true) {
      let servers = ns.scan("home");
      let visited = new Set();
      let stack = [...servers];

      while (stack.length > 0) {
         let server = stack.pop();
         if (!visited.has(server)) {
            visited.add(server);
            let newServers = ns.scan(server);
            for (const newServer of newServers) {
               if (!visited.has(newServer) && !stack.includes(newServer)) {
                  stack.push(newServer);
               }
            }
         }
      }

      const playerHackingLevel = ns.getHackingLevel();
      const purchasedServers = ns.getPurchasedServers();
      const hackableServers = [...visited].filter(s =>
         ns.getServerNumPortsRequired(s) <= 5 &&
         ns.getServerRequiredHackingLevel(s) <= playerHackingLevel &&
         !purchasedServers.includes(s)
      );

      const tools = {
         brutessh: ns.fileExists("BruteSSH.exe", "home"),
         ftpcrack: ns.fileExists("FTPCrack.exe", "home"),
         relaysmtp: ns.fileExists("relaySMTP.exe", "home"),
         httpworm: ns.fileExists("HTTPWorm.exe", "home"),
         sqlinject: ns.fileExists("SQLInject.exe", "home")
      };

      for (const server of hackableServers) {
         if (!ns.hasRootAccess(server)) {
            let numPorts = ns.getServerNumPortsRequired(server);
            let portsOpened = 0;

            if (tools.brutessh && numPorts >= 1) {
               ns.brutessh(server);
               portsOpened++;
            }
            if (tools.ftpcrack && numPorts >= 2) {
               ns.ftpcrack(server);
               portsOpened++;
            }
            if (tools.relaysmtp && numPorts >= 3) {
               ns.relaysmtp(server);
               portsOpened++;
            }
            if (tools.httpworm && numPorts >= 4) {
               ns.httpworm(server);
               portsOpened++;
            }
            if (tools.sqlinject && numPorts >= 5) {
               ns.sqlinject(server);
               portsOpened++;
            }
            if (portsOpened >= numPorts) {
               ns.nuke(server);
            }
         }

         if (!ns.fileExists(hhack, server)) await ns.scp(hhack, server);
         let maxRam = ns.getServerMaxRam(server);
         let scriptRam = ns.getScriptRam(hhack);
         let threads = Math.floor(maxRam / scriptRam);

         if (threads > 0) {
            ns.print(`executing ${server}`);
            ns.exec(hhack, server, threads, server);
         }
      }
      await ns.sleep(100)
   }
}