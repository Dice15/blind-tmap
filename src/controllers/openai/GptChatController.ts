import { NextApiRequest, NextApiResponse } from 'next';
import { Session } from 'next-auth';
import { GptThreadService } from '@/services/externalApi/openai/GptThreadService';
import { GptChatService } from '@/services/externalApi/openai/GptChatService';
import { GptAssistantService } from '@/services/externalApi/openai/GptAssistantService';
import { StationByNameService } from '@/services/externalApi/datakr/StationByNameService';


interface IGptChatControllerParams {
    userMessage: string | undefined;
    chatMode: ("chat" | "blindroute") | undefined;
}


export class GptChatController {
    private constructor() { }


    private static parseGptMessageForChat(gptResponse: string): string {
        const match = gptResponse.match(/@chat\{ msg :\s*([^]*)\s*\}/);

        if (!match) return "";

        let content = match[1].trim();
        content = content.replace(/[^.,'\"!?가-힣\n\s]/g, '');   // 특수 문자 제거
        content = content.replace(/[ ]+/g, ' ');   // 연속된 공백을 하나의 공백으로 대체
        content = content.replace(/\n+/g, '\n');   // 연속된 개행을 하나의 개행으로 대체
        content = content.replace(/\n/g, '.');   // 개행을 온점으로 대체

        return content;
    }


    private static parseGptMessageForBlindRoute(gptResponse: string): { [key: string]: string } {
        const match = gptResponse.match(/\{(.*?)\}/);

        if (!match) {
            return {
                msg: ""
            }
        }

        const content = match[1];
        const pairs = content.split(', ');
        const obj: { [key: string]: string } = {};

        pairs.forEach(pair => {
            const [key, value] = pair.split(' : ').map(s => s.trim());
            obj[key] = value;
        });

        return obj;
    }


    private static async isValidStation(routes: string[]): Promise<boolean> {
        if (!routes[0] || !routes[1]) return false;

        const [checkStart, checkDestination] = await Promise.all([
            StationByNameService.getStationByName(routes[0]).then((getStationByNameResponse) => {
                return (getStationByNameResponse?.msgBody.itemList?.length || 0) > 0;
            }),
            StationByNameService.getStationByName(routes[1]).then((getStationByNameResponse) => {
                return (getStationByNameResponse?.msgBody.itemList?.length || 0) > 0;
            })
        ]);

        return checkStart && checkDestination;
    }


    public static async handleGetGptMessage(request: NextApiRequest, response: NextApiResponse, session: Session): Promise<void> {
        try {
            const { userMessage, chatMode } = request.body as IGptChatControllerParams;
            const threadId = await GptThreadService.getGptThreadId(session.user.id);
            const assistantId = GptAssistantService.getGptAssistantId();

            if (!userMessage || !chatMode) {
                response.status(400).json({ msg: "Missing required body data" });
                return;
            }

            console.log('GptChatController.handleGetGptMessage')
            switch (chatMode as "chat" | "blindroute") {
                case "chat": {
                    const checkChatMode = await GptChatService.getGptMessage(threadId, assistantId, `#request{ msg : ${userMessage} }`).then((gptMessage) => {
                        if (gptMessage.includes("blindroute")) return "blindroute";
                        return "chat";
                    });

                    if (checkChatMode === "blindroute") {
                        response.status(200).json({
                            msg: "정상적으로 처리되었습니다.",
                            data: {
                                message: "",
                                chatMode: checkChatMode,
                            }
                        });
                    }
                    else {
                        await GptChatService.getGptMessage(threadId, assistantId, `#chat{ msg : ${userMessage} }`).then((gptMessage) => {
                            response.status(200).json({
                                msg: "정상적으로 처리되었습니다.",
                                data: {
                                    message: this.parseGptMessageForChat(gptMessage),
                                    chatMode: checkChatMode,
                                }
                            });
                        });
                    }
                    break;
                }
                case "blindroute": {
                    let extractStation = await GptChatService.getGptMessage(threadId, assistantId, `#extract{ msg : ${userMessage} }`).then(async (gptMessage) => {
                        const routes = (this.parseGptMessageForBlindRoute(gptMessage) as { msg: string }).msg.split(',');
                        return {
                            validStation: await this.isValidStation(routes),
                            start: routes[0] || "",
                            destination: routes[1] || "",
                        };
                    });

                    if (!extractStation.validStation) {
                        extractStation = await GptChatService.getGptMessage(threadId, assistantId, `#modify{ msg : ${userMessage} }`).then(async (gptMessage) => {
                            const routes = (this.parseGptMessageForBlindRoute(gptMessage) as { msg: string }).msg.split(',');
                            return {
                                validStation: await this.isValidStation(routes),
                                start: routes[0] || "",
                                destination: routes[1] || "",
                            };
                        });
                    }

                    response.status(200).json({
                        msg: "정상적으로 처리되었습니다.",
                        data: {
                            message: extractStation.validStation ? `${extractStation.start},${extractStation.destination}` : "",
                            chatMode: chatMode,
                        }
                    });
                    break;
                }
                default: {
                    response.status(500).end("잘못된 채팅 모드입니다.");
                }
            }
        } catch (error) {
            console.error(error);
            response.status(500).end(`${error}`);
        }
    }
}