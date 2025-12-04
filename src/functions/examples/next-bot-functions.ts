import type { Agent } from "../../agent";
import { Movements } from "mineflayer-pathfinder";
import type { Block } from "prismarine-block";
import { LLMFunctions } from "../llm-functions";
//import { getNearbyEntities } from "./base-bot-functions";
import type { Bot as MineflayerBot } from "mineflayer";
import 'ses';
import { Vec3 } from 'vec3';

import z from "zod";

import { sleep } from 'bun';

export function getNearestBlocksWhere(agent: Agent, predicate: (block: Block) => boolean, distance = 8, count = 10000) {
    const bot = agent.bot!;

    /**
     * Get a list of the nearest blocks that satisfy the given predicate.
     * @param {Agent} bot - The bot to get the nearest blocks for.
     * @param {function} predicate - The predicate to filter the blocks.
     * @param {number} distance - The maximum distance to search, default 16.
     * @param {number} count - The maximum number of blocks to find, default 10000.
     * @returns {Block[]} - The nearest blocks that satisfy the given predicate.
     * @example
     * let waterBlocks = world.getNearestBlocksWhere(bot, block => block.name === 'water', 16, 10);
     **/
    let positions = bot.findBlocks({ matching: predicate, maxDistance: distance, count: count });
    let blocks = positions.map(position => bot.blockAt(position));
    return blocks;
}

export async function collectBlock(agent: Agent, blockType: string, num = 1, exclude: Position[] | null = null) {
    const bot = agent.bot!;
    /**
     * Collect one of the given block type.
     * @param {MinecraftBot} bot, reference to the minecraft bot.
     * @param {string} blockType, the type of block to collect.
     * @param {number} num, the number of blocks to collect. Defaults to 1.
     * @param {list} exclude, a list of positions to exclude from the search. Defaults to null.
     * @returns {Promise<boolean>} true if the block was collected, false if the block type was not found.
     * @example
     * await skills.collectBlock(bot, "oak_log");
     **/
    if (num < 1) {
        return `Invalid number of blocks to collect: ${num}.`;
    }
    let blocktypes = [blockType];
    if (blockType === 'coal' || blockType === 'diamond' || blockType === 'emerald' || blockType === 'iron' || blockType === 'gold' || blockType === 'lapis_lazuli' || blockType === 'redstone')
        blocktypes.push(blockType + '_ore');
    if (blockType.endsWith('ore'))
        blocktypes.push('deepslate_' + blockType);
    if (blockType === 'dirt')
        blocktypes.push('grass_block');
    if (blockType === 'cobblestone')
        blocktypes.push('stone');
    const isLiquid = blockType === 'lava' || blockType === 'water';

    let collected = 0;

    const movements = new Movements(agent.bot!);
    movements.dontMineUnderFallingBlock = false;
    movements.dontCreateFlow = true;

    // Blocks to ignore safety for, usually next to lava/water
    const unsafeBlocks = ['obsidian'];

    for (let i = 0; i < num; i++) {
        let blocks = getNearestBlocksWhere(agent, block => {
            if (!blocktypes.includes(block.name)) {
                return false;
            }
            if (exclude) {
                for (let position of exclude) {
                    //@ts-ignore
                    if (block.position.x === position.x && block.position.y === position.y && block.position.z === position.z) {
                        return false;
                    }
                }
            }
            if (isLiquid) {
                // collect only source blocks
                return block.metadata === 0;
            }

            //@ts-ignore
            return movements.safeToBreak(block) || unsafeBlocks.includes(block.name);
        }, 64, 1);

        if (blocks.length === 0) {
            break;
        }
        const block = blocks[0];
        const itemId = bot.heldItem ? bot.heldItem.type : null
        if (!block?.canHarvest(itemId)) {
            return false;
        }
        try {
            await bot.collectBlock.collect(block!);
        }
        catch (err) {
        }
    }
    return collected > 0;
}

LLMFunctions.register({
    gameMode: "survival",
    name: "collect_block",
    description: "Collect a block of the given type",
    schema: z.object({
        block_type: z.string().describe("The type of the block to collect, for example 'oak_log', 'coal_ore', 'diamond_ore', 'emerald_ore', 'iron_ore', 'gold_ore', 'lapis_lazuli_ore', 'redstone_ore', 'dirt', 'cobblestone', 'stone', 'grass_block', 'water', 'lava', 'obsidian' etc."),
        num: z.number().describe("The number of blocks to collect")
    }),
    handler: async (agent: Agent, args) => {
        const res = await collectBlock(agent, args.block_type, args.num);
        return "Collected " + args.block_type + " blocks";
    }
})

LLMFunctions.register({
    gameMode: "creative",
    name: "place_structure",
    description: "Place structure of blocks of the given type.",
    schema: z.object({
        origin: z.object({
            x: z.int(),
            y: z.int(),
            z: z.int(),
        }).describe("minimal x,y,z coordinated of the whole structure"),
        size: z.object({
            x: z.int(),
            y: z.int(),
            z: z.int(),
        }).describe("bounding box of the structure, defines dimensions of 'blocks'"),
        structure: z.array(
            z.array(
                z.array(
                    z.string().describe("Minecraft block id. E.g. \"stone\", \"diamond_ore\", etc.")
                ).describe("X layers, length must match size.x")
            ).describe("Y layers, length must match size.y")
        ).describe("Z layers, length must match size.z")
    }),
    handler: async (agent: Agent, args) => {
        console.log(args);

        for (let z = 0; z < args.size.z; z++) {
            let layer_z = args.structure[z];
            if (!layer_z) {
                return `Error: missing Z layer ${z}`;
            }
            for (let y = 0; y < args.size.y; y++) {
                let layer_y = layer_z[y]
                if (!layer_y) {
                    return `Error: missing Y layer ${y}`;
                }
                for (let x = 0; x < args.size.x; x++) {
                    let layer_x = layer_y[x]
                    if (layer_x === undefined) {
                        return `Error: missing X layer ${x}`;
                    }
                    if (!layer_x || layer_x == "") {
                        layer_x = "air";
                    }
                    await sleep(0.1); // to avoid complete spam
                    agent.bot!.chat(`/setblock ${args.origin.x + x} ${args.origin.y + y} ${args.origin.z + z} ${layer_x}`)
                }
            }
        }

        return "Blocks placed";
    }
})



export const makeCompartment = (endowments = {}) => {
    return new Compartment({
        // provide untamed Math, Date, etc
        Math,
        Date,
        // standard endowments
        ...endowments
    });
}

const exampleCode = `
const vec3 = require('vec3');

await bot.chat('Hello, world!');
bot.placeBlock(referenceBlock, faceVector)

/* CODE HERE */

`;

LLMFunctions.register({
    gameMode: "creative",
    group: "unsafe",
    name: "execute_mineflayer_code",
    description: "Execute mineflayer TS code for complex tasks",
    schema: z.object({
        code: z.string().describe(exampleCode)
    }),
    handler: async (agent: Agent, args) => {
        console.log("Executing code: " + args.code);

        const bot = agent.bot;

        const func = makeCompartment({
            require,
            Math,
            Date,
            console,
            Vec3
        }).evaluate(`(async (bot) => {
            ${args.code}
        })`);

        await func(bot!);

        return 'done'
    }
})  