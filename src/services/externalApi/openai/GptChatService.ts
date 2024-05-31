import OpenAiService from './OpenAiService';


export class GptChatService {
    private constructor() { }


    public static async getGptMessage(threadId: string, assistantId: string, userMessage: string): Promise<string> {
        const openai = OpenAiService.getClient();

        try {
            // thread 불러오기
            await openai.beta.threads.messages.create(threadId, {
                role: 'user',
                content: userMessage
            });

            // assistant 적용
            const run = await openai.beta.threads.runs.create(threadId, {
                assistant_id: assistantId
            });

            // 답변이 완료될 때까지 대기
            let runStatus = run.status;
            while (runStatus !== 'completed') {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Polling delay
                const updatedRun = await openai.beta.threads.runs.retrieve(threadId, run.id);
                runStatus = updatedRun.status;
            }

            // 답변 가져오기
            const messages = await openai.beta.threads.messages.list(threadId);
            const assistantMessage = messages.data.find(msg => msg.role === 'assistant');

            console.log(userMessage)
            console.log(assistantMessage?.content[0].type === "text" ? assistantMessage?.content[0].text.value : "")
            return assistantMessage?.content[0].type === "text" ? assistantMessage?.content[0].text.value : "";
        }
        catch (error) {
            console.error(error);
            return "";
        }
    }
}