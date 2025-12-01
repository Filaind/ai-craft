import type { Bot } from "../../bot";
import { LLMFunctions } from "../llm-functions";
import { getNearbyEntities } from "./base-bot-functions";
import type { Entity } from "prismarine-entity";

import item_loader from "prismarine-item";
const Item = item_loader("1.21.1");

import data_loader from "minecraft-data";
const Data = data_loader("1.21.1");

LLMFunctions.register({
    name: "take_block_from_creative",
    description: "Creative mode only. Takes block from creative mode menu and places it into active quickbar slot.",
    parameters: {
        type: "object",
        properties: {
            block_id: { type: "string", description: "Minecraft block id. No tag needed, e.g. \"stone\" or similar." }
        }
    },
    function: async (args: { bot: Bot, block_id: string }) => {
        const block = Data.itemsByName[args.block_id];
        if (!block) {
            return `Block ID ${args.block_id} is invalid!`;
        }
        const item = new Item(block.id, 1);
        const inventorySlot = args.bot.mineflayerBot!.inventory.hotbarStart + args.bot.mineflayerBot!.quickBarSlot;
        await args.bot.mineflayerBot!.creative.setInventorySlot(inventorySlot, item)
        return {
            message: `${block?.displayName} is now in your hand`
        }
    },
    strict: true,
    type: 'function'
})  