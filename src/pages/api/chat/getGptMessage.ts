import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { GptChatController } from '@/controllers/openai/GptChatController';

export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const session = await getServerSession(request, response, authOptions);

    switch (request.method) {
        case 'POST': {
            if (!session) {
                response.status(401).end('Unauthorized');
                return;
            }

            try {
                await GptChatController.handleGetGptMessage(request, response, session);
                break;
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