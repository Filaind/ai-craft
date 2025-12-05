import mineflayer, { type BotOptions } from 'mineflayer'
import pathfinder from "@miner-org/mineflayer-baritone"
import * as pvp from 'mineflayer-pvp';
import { LLMExtension } from './extensions/llm-extension';
import OpenAI from 'openai';
import fs from 'fs';
import * as collectblockPlugin from 'mineflayer-collectblock'
import { translateMessage } from './utils/translator';

export class Agent {
    public bot?: mineflayer.Bot;
    private llm: LLMExtension;
    private messagePushed: boolean = false;
    private msgDebounceTimer: NodeJS.Timeout | null = null;

    private static BOT_DATA_PATH: string = 'bots-data';

    constructor(options: BotOptions, llmClient: OpenAI) {
        this.llm = new LLMExtension(this, llmClient);
        this.start(options)
    }

    async start(options: BotOptions) {
        this.bot = mineflayer.createBot({
            ...options,
        })

        this.bot.loadPlugin(pathfinder.loader)
        this.bot.loadPlugin(pvp.plugin)
        this.bot.loadPlugin(collectblockPlugin.plugin)

        this.bot.on('spawn', this.onSpawn.bind(this))
        this.bot.on('chat', this.onChatMessage.bind(this))

        // Log errors and kick reasons:
        this.bot.on('kicked', console.log)
        this.bot.on('error', console.log)

        //this.bot.on('game', this.onGameStateChanged.bind(this))

        //@ts-ignore
        this.bot.on('stoppedAttacking', this.onStoppedAttacking.bind(this))
    }

    async sendChatMessage(message: string) {
        if (message == "NO ANSWER") return;
        const sanitized = message.replace(/[^a-zA-Zа-яА-Я0-9 .,!?-_:;'"()+]/g, '').trim();
        //хз

        const translated = await translateMessage(sanitized, 'ru');
        this.bot!.chat("/say %" + translated);
    }

    getBotDataPath() {
        return `${Agent.BOT_DATA_PATH}/${this.bot!.username}`;
    }

    async onSpawn() {
        fs.mkdirSync(this.getBotDataPath(), { recursive: true });
        await this.bot!.waitForChunksToLoad();

        this.bot!.ashfinder.config.parkour = true; // Allow parkour jumps
        this.bot!.ashfinder.config.breakBlocks = true; // Allow breaking blocks
        this.bot!.ashfinder.config.placeBlocks = true; // Allow placing blocks
        this.bot!.ashfinder.config.swimming = true; // Allow swimming

        console.log("Bot spawned", this.bot!.username);
        const entity = this.bot!.nearestEntity()
        if (entity) {
            console.log("Nearest entity", entity.name);
        }
    }

    async onChatMessage(username: string, message: string) {
        //Игнорируем сообщения от бота
        if (username === this.bot!.username || message.startsWith('%')) return

        console.log('onChatMessage', username, message);

        const translated = await translateMessage(message, 'en');
        this.llm.pushChatMessage(translated, username);
        this.messagePushed = true;

        if (this.msgDebounceTimer) {
            clearTimeout(this.msgDebounceTimer);
        }

        //3 секунды собираем сообщения в чате, чтобы не было лишних запросов к LLM
        this.msgDebounceTimer = setTimeout(async () => {
            if (this.messagePushed) {
                this.messagePushed = false;
                
                const response = await this.llm.getResponse();
                this.sendChatMessage(response);
            }
            this.msgDebounceTimer = null;
        }, 3000);
    }

    async onStoppedAttacking(entity: any) {
        //"Done attacking"
        const response = await this.llm.getResponse()
        this.sendChatMessage(response)
    }
}