import { scanAll } from "./util.js";

export async function main(ns) {
    ns.tprint("INFO: Starting search for .lit and .msg files...");

    const allServers = scanAll(ns);
    let filesCopiedCount = 0;

    for (const server of allServers) {
        if (!ns.hasRootAccess(server)) {
            continue;
        }

        if (server === "home") {
            continue;
        }
        
        const filesOnServer = ns.ls(server);
        const targetFiles = filesOnServer.filter(file => file.endsWith(".lit") || file.endsWith(".msg"));

        if (targetFiles.length > 0) {
            ns.tprint(`SUCCESS: Found ${targetFiles.length} target file(s) on [${server}]`);
            
            for (const file of targetFiles) {
                const success = await ns.scp(file, "home", server);

                if (success) {
                    ns.tprint(`  -> Copied "${file}" to home.`);
                    filesCopiedCount++;
                } else {
                    ns.tprint(`  -> FAILED to copy "${file}" from ${server}.`);
                }
            }
        }
    }
    
    ns.tprint("---------------------------------");
    if (filesCopiedCount > 0) {
        ns.tprint(`SUCCESS: Finished! Copied a total of ${filesCopiedCount} new file(s) to home.`);
    } else {
        ns.tprint("INFO: Scan complete. No new .lit or .msg files were found.");
    }
}