import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import OpenAI from 'openai';
import { authOptions } from '../auth/[...nextauth]';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


async function getGptResponse(threadId: string, assistantId: string, requestMessage: string) {
    // thread 불러오기
    await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: requestMessage
    });

    // assistant 불러오기
    const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId
    });

    // thread 실행이 완료될 때까지 대기
    let runStatus = run.status;
    while (runStatus !== 'completed') {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Polling delay
        const updatedRun = await openai.beta.threads.runs.retrieve(threadId, run.id);
        runStatus = updatedRun.status;
    }

    // thread에서 메시지 가져오기
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantMessage = messages.data.find(msg => msg.role === 'assistant');
    return assistantMessage?.content[0].type === "text" ? assistantMessage?.content[0].text.value : "";
}


function parseGptResponse(gptResponse: string) {
    const content = gptResponse.match(/\{(.*?)\}/)![1];
    const pairs = content.split(', ');
    const obj: { [key: string]: string } = {};

    pairs.forEach(pair => {
        const [key, value] = pair.split(' : ').map(s => s.trim());
        obj[key] = value;
    });

    return obj;
}


async function isValidStation(routes: string[]) {
    if (!routes[0] || !routes[1]) return false;
    const checkStart = (await axios.get<GetStationByNameResponse>(
        "http://ws.bus.go.kr/api/rest/stationinfo/getStationByName",
        {
            params: {
                serviceKey: decodeURIComponent(process.env.DATA_API_ENCODING_KEY4),
                stSrch: routes[0],
                resultType: "json"
            }
        }
    )).data.msgBody.itemList?.length > 0;

    const checkDestination = (await axios.get<GetStationByNameResponse>(
        "http://ws.bus.go.kr/api/rest/stationinfo/getStationByName",
        {
            params: {
                serviceKey: decodeURIComponent(process.env.DATA_API_ENCODING_KEY4),
                stSrch: routes[1],
                resultType: "json"
            }
        }
    )).data.msgBody.itemList?.length > 0

    return checkStart && checkDestination;
}


export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const session = await getServerSession(request, response, authOptions);

    switch (request.method) {
        case 'POST': {
            if (!session) {
                response.status(401).end('Unauthorized');
                return;
            }

            try {
                const { threadId, userMessage, chatMode } = request.body;
                const assistantId = process.env.BLINDROUTE_ASSISTANT_V2;

                switch (chatMode as "chat" | "blindroute") {
                    case "chat": {
                        const checkChatMode = await getGptResponse(threadId, assistantId, `#request{ msg : ${userMessage} }`).then(value => {
                            if (value.includes("blindroute")) return "blindroute";
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
                            await getGptResponse(threadId, assistantId, `#chat{ msg : ${userMessage} }`).then(value => {
                                response.status(200).json({
                                    msg: "정상적으로 처리되었습니다.",
                                    data: {
                                        message: (parseGptResponse(value) as { msg: string }).msg,
                                        chatMode: checkChatMode,
                                    }
                                });
                            });
                        }
                        break;
                    }
                    case "blindroute": {
                        let extractStation = await getGptResponse(threadId, assistantId, `#extract{ msg : ${userMessage} }`).then(async (value) => {
                            const routes = (parseGptResponse(value) as { msg: string }).msg.split(',');
                            return {
                                validStation: await isValidStation(routes),
                                start: routes[0] || "",
                                destination: routes[1] || "",
                            };
                        });

                        if (!extractStation.validStation) {
                            extractStation = await getGptResponse(threadId, assistantId, `#modify{ msg : ${userMessage} }`).then(async (value) => {
                                const routes = (parseGptResponse(value) as { msg: string }).msg.split(',');
                                return {
                                    validStation: await isValidStation(routes),
                                    start: routes[0] || "",
                                    destination: routes[1] || "",
                                };
                            });
                        }

                        console.log(userMessage);
                        console.log(extractStation);
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
            break;
        }
        default: {
            response.setHeader('Allow', ['POST']);
            response.status(405).end(`Method ${request.method} Not Allowed`);
        }
    }
}


interface GetStationByNameResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: {
        itemList: StationInfo[];
    };
}


interface ComMsgHeader {
    errMsg: string | null;
    requestMsgID: string | null;
    responseMsgID: string | null;
    responseTime: string | null;
    successYN: string | null;
    returnCode: string | null;
}


interface MsgHeader {
    headerMsg: string;
    headerCd: string;
    itemCount: number;
}


interface StationInfo {
    stId: string;
    stNm: string;
    tmX: string;
    tmY: string;
    posX: string;
    posY: string;
    arsId: string;
}