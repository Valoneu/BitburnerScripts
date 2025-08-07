/** @param {NS} ns */
export async function main(ns) {
    while (true) {
        ns.clearLog();
        const functionsToDisable = ['disableLog', 'scan', 'getServerRequiredHackingLevel', 'getServerMoneyAvailable', 'getServerMaxMoney', 'getServerSecurityLevel', 'getServerMinSecurityLevel', 'getServerNumPortsRequired', 'getServerMaxRam', 'getServerGrowth', 'getServerMaxRam', 'getHackingLevel', 'sleep', 'getHackTime', 'getGrowTime', 'getWeakenTime'];
        for (const func of functionsToDisable) {
            ns.disableLog(func);
        }
        const allServers = scanAllServers(ns, "home");

        // Sort servers by required hacking level
        allServers.sort((a, b) => {
            const hackingLevelA = ns.getServerRequiredHackingLevel(a);
            const hackingLevelB = ns.getServerRequiredHackingLevel(b);
            return hackingLevelA - hackingLevelB;
        });

        ns.printf("Server Statistics:");
        ns.printf("====================╦=====╦================╦==============╦==╦===========╦=╦======");
        ns.printf("Hostname            ║HLvl ║A.M.  /M. Money ║S lvl  /Min S ║Op║RAM        ║R║Score ");

        function stripAnsiCodes(str) {
            return str.replace(/\x1b\[[0-9;]*m/g, '');
        }

        function getColorizedRam(maxRam) {
            maxRam /= 1024;
            return maxRam > 1024 ? `\x1b[38;5;64m${maxRam.toLocaleString()} TB\x1b[0m` 
            : maxRam > 128 ? `\x1b[38;5;76m${maxRam.toLocaleString()} TB\x1b[0m` 
            : maxRam > 32 ? `\x1b[38;5;220m${maxRam.toLocaleString()} TB\x1b[0m` 
            : maxRam > 0 ? `\x1b[38;5;208m${maxRam.toLocaleString()} TB\x1b[0m` 
            : `\x1b[38;5;196m${maxRam.toLocaleString()} TB\x1b[0m`;
        }

        function getColorizedHackingLevel(level) {
            let chlvl = ns.getHackingLevel();
            return level > chlvl * 4 ? `\x1b[38;5;196m${level}\x1b[0m` : level > chlvl * 2 ? `\x1b[38;5;208m${level}\x1b[0m` : level > chlvl ? `\x1b[38;5;220m${level}\x1b[0m` : level > chlvl / 2 ? `\x1b[38;5;76m${level}\x1b[0m` : `\x1b[38;5;64m${level}\x1b[0m`;
        }

        function getColorizedMoney(amount, server) {
            let formattedAmount;
            let moneyPercent = 0;
            if (amount != 0) { moneyPercent = (amount / ns.getServerMaxMoney(server)) * 100; }
            else { moneyPercent = 0 }

            formattedAmount = moneyPercent.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

            return moneyPercent >= 90 ? `\x1b[38;5;64m${formattedAmount}%%\x1b[0m`
                : moneyPercent >= 75 ? `\x1b[38;5;76m${formattedAmount}%%\x1b[0m`
                    : moneyPercent >= 35 ? `\x1b[38;5;184m${formattedAmount}%%\x1b[0m`
                        : moneyPercent >= 10 ? `\x1b[38;5;220m${formattedAmount}%%\x1b[0m`
                            : moneyPercent >= 5 ? `\x1b[38;5;208m${formattedAmount}%%\x1b[0m`
                                : moneyPercent >= 0 ? `\x1b[38;5;196m${formattedAmount}%%\x1b[0m`
                                    : `\x1b[38;5;64m${formattedAmount}%%\x1b[0m`;
        }

        function getColorizedMaxMoney(amount) {
            let formattedAmount;
            let suffix = '';
            let aamount = 0;

            if (amount >= 1000000000) {
                aamount = amount / 1000000000; suffix = ' B';
            } else if (amount >= 1000000) {
                aamount = amount / 1000000; suffix = ' M';
            } else if (amount >= 1000) {
                aamount = amount / 1000; suffix = ' K';
            }

            formattedAmount = aamount.toFixed(2);

            return amount >= 100000000000 ? `\x1b[38;5;64m${formattedAmount}${suffix}\x1b[0m`
                : amount >= 10000000000 ? `\x1b[38;5;76m${formattedAmount}${suffix}\x1b[0m`
                    : amount >= 1000000000 ? `\x1b[38;5;184m${formattedAmount}${suffix}\x1b[0m`
                        : amount >= 100000000 ? `\x1b[38;5;220m${formattedAmount}${suffix}\x1b[0m`
                            : amount >= 10000000 ? `\x1b[38;5;208m${formattedAmount}${suffix}\x1b[0m`
                                : amount >= 0 ? `\x1b[38;5;196m${formattedAmount}${suffix}\x1b[0m`
                                    : `\x1b[38;5;64m${formattedAmount}${suffix}\x1b[0m`;
        }

        function getColorizedSecurityLevel(level, server) {
            let mSec = ns.getServerMinSecurityLevel(server);
            return level < 0 + mSec ? `\x1b[38;5;64m${level.toFixed(2)}\x1b[0m` : level < 10 + mSec ? `\x1b[38;5;76m${level.toFixed(2)}\x1b[0m` : level < 20 + mSec ? `\x1b[38;5;184m${level.toFixed(2)}\x1b[0m` : level < 30 + mSec ? `\x1b[38;5;220m${level.toFixed(2)}\x1b[0m` : level < 40 + mSec ? `\x1b[38;5;208m${level.toFixed(2)}\x1b[0m` : `\x1b[31m${level.toFixed(2)}\x1b[0m`;
        }

        function getColorizedMinSecurityLevel(level, server) {
            return level < 0 ? `\x1b[38;5;64m${level.toFixed(2)}\x1b[0m` : level < 10 ? `\x1b[38;5;76m${level.toFixed(2)}\x1b[0m` : level < 20 ? `\x1b[38;5;184m${level.toFixed(2)}\x1b[0m` : level < 30 ? `\x1b[38;5;220m${level.toFixed(2)}\x1b[0m` : level < 40 ? `\x1b[38;5;208m${level.toFixed(2)}\x1b[0m` : `\x1b[31m${level.toFixed(2)}\x1b[0m`;
        }

        function getColorizedPortsRequired(ports) {
            return ports < 1 ? `\x1b[38;5;251m${ports}\x1b[0m` : ports < 2 ? `\x1b[38;5;64m${ports}\x1b[0m` : ports < 3 ? `\x1b[38;5;76m${ports}\x1b[0m` : ports < 4 ? `\x1b[38;5;220m${ports}\x1b[0m` : ports < 5 ? `\x1b[38;5;208m${ports}\x1b[0m` : `\x1b[38;5;196m${ports}\x1b[0m`;
        }

        function getColorizedScore(server) {

            const maxMoney = ns.getServerMaxMoney(server);
            const growRate = ns.getServerGrowth(server);
            const growTime = ns.getGrowTime(server);
            const weakTime = ns.getWeakenTime(server);
            let score = 0;
            if (maxMoney != 0) {
                score = (maxMoney * 0.25 / growRate * growTime - 5 * weakTime)
                score = Math.log(score) / Math.log(1.25)
                score = score - 100
            }
            else { score = 0 }

            return score > 60 ? `\x1b[38;5;64m${score.toFixed(0)}\x1b[0m` : score > 50 ? `\x1b[38;5;76m${score.toFixed(0)}\x1b[0m` : score > 35 ? `\x1b[38;5;220m${score.toFixed(0)}\x1b[0m` : score > 10 ? `\x1b[38;5;208m${score.toFixed(0)}\x1b[0m` : `\x1b[38;5;196m${score.toFixed(0)}\x1b[0m`;
        }

        function padRight(str, len) {
            const strippedStr = stripAnsiCodes(str);
            return strippedStr.length >= len ? str : str + ' '.repeat(len - strippedStr.length);
        }

        for (const server of allServers) {
            const serverStats = getServerStats(ns, server);
            ns.printf(
                `${padRight(serverStats.hostname, 20)}┃` +
                `${padRight(getColorizedHackingLevel(serverStats.requiredHackingLevel.toString()), 5)}┃` +
                `${padRight(getColorizedMoney(serverStats.moneyAvailable, server), 7)}»` +
                `${padRight(getColorizedMaxMoney(serverStats.maxMoney), 9)}┃` +
                `${padRight(getColorizedSecurityLevel(serverStats.securityLevel, server), 6)} » ` +
                `${padRight(getColorizedMinSecurityLevel(serverStats.minSecurityLevel), 5)}┃` +
                `${padRight(getColorizedPortsRequired(serverStats.numOpenPortsRequired.toString()), 2)}┃` +
                `${padRight(getColorizedRam(serverStats.maxRam), 11)}┃` +
                `${serverStats.hasRootAccess ? "\x1b[32mY" : "\x1b[31mN"}\x1b[0m┃` +
                `${padRight(getColorizedScore(server.toString()), 8)}`
            );
        }
        await ns.sleep(100);
    }
}

/**
 * Custom function to scan and map all servers in the network.
 * @param {NS} ns - Netscript object
 * @param {string} startServer - The starting server for the scan
 * @returns {string[]} - List of all discovered servers
 */
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

/**
 * Custom function to get statistics for a server.
 * @param {NS} ns - Netscript object
 * @param {string} server - The server to get statistics for
 * @returns {Object} - Server statistics
 */
function getServerStats(ns, server) {
    return {
        hostname: server,
        requiredHackingLevel: ns.getServerRequiredHackingLevel(server),
        moneyAvailable: ns.getServerMoneyAvailable(server),
        maxMoney: ns.getServerMaxMoney(server),
        securityLevel: ns.getServerSecurityLevel(server),
        minSecurityLevel: ns.getServerMinSecurityLevel(server),
        numOpenPortsRequired: ns.getServerNumPortsRequired(server),
        maxRam: ns.getServerMaxRam(server),
        hasRootAccess: ns.hasRootAccess(server)
    };
}

/**
 * Pad the string to the right with spaces to reach the desired length.
 * @param {string|number} str - The input string or number
 * @param {number} len - The desired length of the string
 * @returns {string} - The padded string
 */
function padRight(str, len) {
    str = str.toString();
    return str + " ".repeat(Math.max(0, len - str.length));
}