import mineflayer, { type BotOptions } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder';



export class Bot {
    private bot?: mineflayer.Bot;

    constructor(options: BotOptions) {
        this.start(options)
    }

    async start(options: BotOptions) {

        this.bot = mineflayer.createBot({
            ...options,
        })

        this.bot.loadPlugin(pathfinder)

        this.bot.on('chat', (username: string, message: string) => {
            if (username === this.bot!.username) return
            this.bot!.chat(message)
        })

        // Log errors and kick reasons:
        this.bot.on('kicked', console.log)
        this.bot.on('error', console.log)
    }


    async llmProcess() {
        
    }
}