import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { BusStationByNameController } from '@/controllers/station/BusStationByNameController';


export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const session = await getServerSession(request, response, authOptions);

    if (!session) {
        response.status(401).end('Unauthorized');
        return;
    }

    switch (request.method) {
        case 'GET': {
            await BusStationByNameController.handleGetBusStationByName(request, response);
            break;
        }
        default: {
            response.setHeader('Allow', ['GET']);
            response.status(405).end(`Method ${request.method} Not Allowed`);
        }
    }
}