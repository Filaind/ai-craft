import type { Agent } from "../../agent";
import { LLMFunctions, type LLMFunctionResult } from "../llm-functions";
import { getNearbyEntities } from "./base-bot-functions";
import type { Entity } from "prismarine-entity";

import z from "zod";

export async function discard(agent: Agent, itemName: string, num = -1): Promise<LLMFunctionResult> {
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
        return {
            result: "error",
            message: `You do not have any ${itemName} to discard.`
        };
    } else {
        return {
            result: "success",
            message: `Discarded ${discarded} ${itemName}.`
        };
    }
}

export async function giveToPlayer(agent: Agent, itemType: string, entity: Entity, num = 1): Promise<LLMFunctionResult> {
    const bot = agent.bot!;

    const distance = entity.position.distanceTo(agent.bot!.entity.position);
    if (distance > 4) {
        return {
            result: "error",
            message: `Entity ${entity.username} is too far away to give items to (${distance} blocks).`
        }
    }

    await bot.lookAt(entity.position);
    if ((await discard(agent, itemType, num)).result == "success") {
        return {
            result: "success",
            message: `Given ${itemType} to ${entity.username}.`
        };
    } else {
        return {
            result: "error",
            message: `Failed to give ${itemType} to ${entity.username}, it was never received.`
        };
    }
}

LLMFunctions.register({
    name: "check_inventory",
    description: "Returns list of items in inventory",
    schema: z.object({}),
    handler: async (agent: Agent, args) => ({
        message: agent.bot!.inventory.items().map(({slot, name, count, type}) => ({
            slot, name, count, type
        }))
    })
})

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
        
        return await giveToPlayer(agent, args.item_type, entity, args.num);
    }
})  