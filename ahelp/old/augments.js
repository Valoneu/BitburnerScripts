/** @param {NS} ns */
export async function main(ns) {
    const player = ns.getPlayer();
    const factions = player.factions;
    const purchasedAugmentations = ns.singularity.getOwnedAugmentations(true);

    for (const faction of factions) {
        const augmentations = ns.singularity.getAugmentationsFromFaction(faction);

        for (const augmentation of augmentations) {
            // Skip already owned augmentations
            if (purchasedAugmentations.includes(augmentation)) {
                continue;
            }
            
            const cost = ns.singularity.getAugmentationPrice(augmentation);
            const repReq = ns.singularity.getAugmentationRepReq(augmentation);
            const factionRep = ns.singularity.getFactionRep(faction);

            if (ns.getServerMoneyAvailable('home') >= cost && factionRep >= repReq) {
                const success = ns.singularity.purchaseAugmentation(faction, augmentation);
                if (success) {
                    ns.tprint(`Purchased ${augmentation} from ${faction}`);
                } else {
                    ns.tprint(`Failed to purchase ${augmentation} from ${faction}`);
                }
            }
        }
    }
}
