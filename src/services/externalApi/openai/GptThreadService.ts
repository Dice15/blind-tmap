import OpenAiService from './OpenAiService';
import MongoDbService from '../mongodb/MongoDbService';


export class GptThreadService {
    private constructor() { }


    public static async getGptThreadId(useId: string): Promise<string> {
        return MongoDbService.getDb().then(async (db) => {
            const savedThread = await db.collection("gptthreadv2").findOne({ id: useId });

            if (savedThread) {
                return savedThread.threadId as string;
            }

            return OpenAiService.getClient().beta.threads.create().then(async (thread) => {
                await db.collection("gptthreadv2").insertOne({ id: useId, threadId: thread.id });
                return thread.id;
            });
        });
    }
}