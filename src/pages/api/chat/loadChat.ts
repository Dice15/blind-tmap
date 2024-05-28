import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import OpenAI from "openai";
import { authOptions } from '../auth/[...nextauth]';
import MongoDbProvider from '@/core/modules/database/MongoDbProvider';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const db = await MongoDbProvider.connectDb(process.env.BLINDROUTE_MONGODB_URI).then(() => MongoDbProvider.getDb());
    const session = await getServerSession(request, response, authOptions);

    switch (request.method) {
        case "GET": {
            if (!session) {
                response.status(401).end('Unauthorized');
                return;
            }

            const savedThread = await db.collection("gptthreadv2").findOne({ id: session.user.id });
            if (savedThread) {
                response.status(200).json({
                    msg: "정상적으로 처리되었습니다.",
                    data: { threadId: savedThread.threadId }
                });
            }
            else {
                try {
                    await openai.beta.threads.create().then(async (value) => {
                        await db.collection("gptthreadv2").insertOne({
                            id: session.user.id,
                            threadId: value.id
                        });
                        response.status(200).json({
                            msg: "정상적으로 처리되었습니다.",
                            data: { threadId: value.id }
                        });
                    });
                } catch (error) {
                    response.status(502).end(`${error}`);
                }
            }
            break;
        }
        default: {
            response.status(405).end('Method Not Allowed');
            break;
        }
    }
}