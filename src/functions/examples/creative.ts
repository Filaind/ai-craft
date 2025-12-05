import type { Agent } from "../../agent";
import { LLMFunctions } from "../llm-functions";
import { goals } from "@miner-org/mineflayer-baritone";

import z from "zod"
import { Vec3 } from "vec3"

import item_loader from "prismarine-item";
const Item = item_loader("1.21.1");

import data_loader from "minecraft-data";
const Data = data_loader("1.21.1");

LLMFunctions.register({
    gameMode: "creative",
    name: "take_item_from_creative",
    description: "Takes item or block from creative mode menu and places it into active quickbar slot",
    schema: z.object({
        item_id: z.string().describe("Minecraft item id. No tag needed, e.g. \"stone\" or similar."),
        amount: z.int().min(1).max(64).describe("Amount of items to take")
    }),
    handler: async (agent: Agent, args) => {
        const item = Data.itemsByName[args.item_id];
        if (!item) return `Item ID ${args.item_id} is invalid!`;

        const new_item = new Item(item.id, args.amount);
        const inventorySlot = agent.bot!.inventory.hotbarStart + agent.bot!.quickBarSlot;
        await agent.bot!.creative.setInventorySlot(inventorySlot, new_item)
        return { message: `${item?.displayName} is now in your hand` }
    }
})

LLMFunctions.register({
    gameMode: "creative",
    name: "break_blocks_at_position",
    description: "Instantaneously break blocks at specified coordinates",
    schema: z.object({
        blocks: z.array(
            z.tuple([
                z.int().describe("x"),
                z.int().describe("y"), 
                z.int().describe("z"),
            ])
        ).describe("List of block coordinates to break").min(1).max(64)
    }),
    handler: async (agent: Agent, args) => {
        if (args.blocks.length == 0) return "No block coordinates specified!";
        const mbot = agent.bot!;
        let dug = 0;
        for (let pos of args.blocks) {
            const vec = new Vec3(pos[0], pos[1], pos[2]);
            let block = mbot.blockAt(vec);
            if (!block || block.name == "air") continue;
    
            const goal = new goals.GoalNear(vec, 2);
            await mbot.ashfinder.goto(goal);
            await mbot.dig(block, true);
            dug++;
        }
        if (dug == 0) return "No blocks were broken. All air?"
        return { message: `${dug} blocks were broken` };
    }
})


