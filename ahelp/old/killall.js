/** @param {NS} ns */
export async function main(ns) {

   let servers = ns.scan();
   for (let i = 0; i < servers.length; i++) {
      let newServers = ns.scan(servers[i]);
      for (const newServer of newServers) {
         if (!servers.includes(newServer)) {
            servers.push(newServer);
         }
      }
   }

   for (let server of servers) {
      ns.killall(server);
   }
}