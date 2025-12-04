import type { Agent } from "../../agent";
import { LLMFunctions } from "../llm-functions";
import { getNearbyEntities } from "./base-bot-functions";
import type { Entity } from "prismarine-entity";

import z from "zod";

export async function discard(agent: Agent, itemName: string, num = -1) {
    /**
     * Discard the given item.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} itemName, the item or block name to discard.
     * @param {number} num, the number of items to discard. Defaults to -1, which discards all items.
     * @returns {Promise<boolean>} true if the item was discarded, false otherwise.
     * @example
     * await skills.discard(bot, "oak_log");
     **/
    const bot = agent.bot!;
    let discarded = 0;
    while (true) {
        let item = bot.inventory.items().find(item => item.name === itemName);
        if (!item) {
            break;
        }
        let to_discard = num === -1 ? item.count : Math.min(num - discarded, item.count);
        await bot.toss(item.type, null, to_discard);
        discarded += to_discard;
        if (num !== -1 && discarded >= num) {
            break;
        }
    }
    if (discarded === 0) {
        return `You do not have any ${itemName} to discard.`;
    }
    return `Discarded ${discarded} ${itemName}.`;
}

export async function giveToPlayer(agent: Agent, itemType: string, entity: Entity, num = 1) {
    const bot = agent.bot!;

    await bot.lookAt(entity.position);
    if (await discard(agent, itemType, num)) {
        return `Given ${itemType} to ${entity.username}.`;
    }
    return `Failed to give ${itemType} to ${entity.username}, it was never received.`;
}

// LLMFunctions.register({
//     name: "show_inventory",
//     parameters: {
//         type: "object",
//         properties: {}
//     },
//     function: (args: { bot: Bot }) => {
//         return args.bot.bot!.inventory.items().map((item) => {
//             return {
//                 name: item.name,
//                 count: item.count,
//                 type: item.type
//             }
//         })
//     },
//     strict: true,
//     type: 'function'
// })

LLMFunctions.register({
    name: "give_item_to_entity",
    description: "Give an item to an player or entity",
    schema: z.object({
        item_type: z.string().describe("The type of the item to give"),
        entity_id: z.string().describe("The id of the entity to give the item to"),
        num: z.number().describe("The number of items to give")
    }),
    handler: async (agent: Agent, args) => {
        let entity = agent.bot!.entities[args.entity_id];
        if (!entity) return `Entity with ID ${args.entity_id} is not found!`;
        
        const res = await giveToPlayer(agent, args.item_type, entity, args.num);
        console.log(res)
        return {
            message: res,
            //stop_calling: true
        }
    }
})  