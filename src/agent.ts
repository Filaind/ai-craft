import mineflayer, { type BotOptions } from 'mineflayer'
import pathfinder from "@miner-org/mineflayer-baritone"
import * as pvp from 'mineflayer-pvp';
import { LLMExtension } from './extensions/llm-extension';
import OpenAI from 'openai';
import fs from 'fs';
import * as collectblockPlugin from 'mineflayer-collectblock'

export class Agent {
    public mineflayerBot?: mineflayer.Bot;
    private llm: LLMExtension;


    private static BOT_DATA_PATH: string = 'bots-data';

    public todoList: string = ""

    constructor(options: BotOptions, llmClient: OpenAI) {
        this.llm = new LLMExtension(this, llmClient);
        this.start(options)
    }

    async start(options: BotOptions) {
        this.mineflayerBot = mineflayer.createBot({
            ...options,
        })

        this.mineflayerBot.loadPlugin(pathfinder.loader)
        this.mineflayerBot.loadPlugin(pvp.plugin)
        this.mineflayerBot.loadPlugin(collectblockPlugin.plugin)



        this.mineflayerBot.on('spawn', this.onSpawn.bind(this))
        this.mineflayerBot.on('chat', this.onChatMessage.bind(this))

        // Log errors and kick reasons:
        this.mineflayerBot.on('kicked', console.log)
        this.mineflayerBot.on('error', console.log)

        //this.mineflayerBot.on('game', this.onGameStateChanged.bind(this))

        //@ts-ignore
        this.mineflayerBot.on('stoppedAttacking', this.onStoppedAttacking.bind(this))
    }

    sendChatMessage(message: string) {
        const sanitized = message.replace(/[^a-zA-Zа-яА-Я0-9 .,!?-_:;'"()+]/g, '').trim();
        //хз
        this.mineflayerBot!.chat("/say %" + sanitized);
    }

    getBotDataPath() {
        return `${Agent.BOT_DATA_PATH}/${this.mineflayerBot!.username}`;
    }

    async onSpawn() {
        fs.mkdirSync(this.getBotDataPath(), { recursive: true });
        await this.mineflayerBot!.waitForChunksToLoad();

        this.mineflayerBot!.ashfinder.config.parkour = true; // Allow parkour jumps
        this.mineflayerBot!.ashfinder.config.breakBlocks = true; // Allow breaking blocks
        this.mineflayerBot!.ashfinder.config.placeBlocks = true; // Allow placing blocks
        this.mineflayerBot!.ashfinder.config.swimming = true; // Allow swimming

        console.log("Bot spawned", this.mineflayerBot!.username);
        const entity = this.mineflayerBot!.nearestEntity()
        if (entity) {
            console.log("Nearest entity", entity.name);
        }
    }


    async onChatMessage(username: string, message: string) {
        //Игнорируем сообщения от бота
        if (username === this.mineflayerBot!.username || message.startsWith('%')) return

        console.log('onChatMessage', username, message);


        const response = await this.llm.getResponse(`User ${username} said: ${message}`)

        this.sendChatMessage(response)

    }


    async onStoppedAttacking(entity: any) {
        const response = await this.llm.getResponse("Done attacking")
        this.sendChatMessage(response)
    }
}