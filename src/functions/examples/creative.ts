import type { Agent } from "../../agent";
import { LLMFunctions } from "../llm-functions";
import { Movements, goals } from "mineflayer-pathfinder";

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
        if (!item) {
            return `Item ID ${args.item_id} is invalid!`;
        }
        const new_item = new Item(item.id, args.amount);
        const inventorySlot = agent.mineflayerBot!.inventory.hotbarStart + agent.mineflayerBot!.quickBarSlot;
        await agent.mineflayerBot!.creative.setInventorySlot(inventorySlot, new_item)
        return {
            message: `${item?.displayName} is now in your hand`
        }
    }
})

LLMFunctions.register({
    gameMode: "creative",
    name: "break_block_at_position",
    description: "Instantaneously break block at specified coordinates. Make sure you can reach it with your hand.",
    schema: z.object({
        x: z.int(),
        y: z.int(),
        z: z.int(),
    }),
    handler: async (agent: Agent, args) => {
        const mbot = agent.mineflayerBot!;
        const pos = new Vec3(args.x, args.y, args.z);
        const pos_str = `(${pos.x}, ${pos.y}, ${pos.z})`;

        let block = mbot.blockAt(pos);
        if (!block) return `There is no block at ${pos_str}`;
        let distance = mbot.entity.position.distanceTo(pos);
        if (distance > 4) return `Block is too far! Distance: ${distance}`;

        const defaultMove = new Movements(agent.mineflayerBot!)
        agent.mineflayerBot!.pathfinder.setMovements(defaultMove)
        await mbot.pathfinder.goto(new goals.GoalBreakBlock(pos, mbot.world, { reach: 4 }))
        return `"${block.displayName}" at ${pos_str} was broken.`
    }
})


