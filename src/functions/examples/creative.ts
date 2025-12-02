import type { Bot } from "../../bot";
import { LLMFunctions } from "../llm-functions";
import { getNearbyEntities } from "./base-bot-functions";
import type { Entity } from "prismarine-entity";

import item_loader from "prismarine-item";
const Item = item_loader("1.21.1");

import data_loader from "minecraft-data";
const Data = data_loader("1.21.1");

LLMFunctions.register({
    name: "take_item_from_creative",
    description: "Creative mode only. Takes item or block from creative mode menu and places it into active quickbar slot.",
    parameters: {
        type: "object",
        properties: {
            item_id: { type: "string", description: "Minecraft item id. No tag needed, e.g. \"stone\" or similar." },
            amount: { type: "number", description: "Amount of items to take. Minimum is 1, maximum is 64." }
        }
    },
    function: async (args: { bot: Bot, item_id: string, amount: number }) => {
        const item = Data.itemsByName[args.item_id];
        if (!item) {
            return `Item ID ${args.item_id} is invalid!`;
        }
        const new_item = new Item(item.id, args.amount);
        const inventorySlot = args.bot.mineflayerBot!.inventory.hotbarStart + args.bot.mineflayerBot!.quickBarSlot;
        await args.bot.mineflayerBot!.creative.setInventorySlot(inventorySlot, new_item)
        return {
            message: `${item?.displayName} is now in your hand`
        }
    },
    strict: true,
    type: 'function'
})
