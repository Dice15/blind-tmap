import { NextApiRequest, NextApiResponse } from 'next';
import { StationByNameService } from '@/services/externalApi/datakr/StationByNameService';
import { StationByUidItemService } from '@/services/externalApi/datakr/StationByUidItemService';
import IStation from '@/models/IStation';

interface IHandleGetBusStationByNameParams {
    stationName: string | undefined;
}

export class BusStationByNameController {
    private constructor() { }


    public static async handleGetBusStationByName(request: NextApiRequest, response: NextApiResponse): Promise<void> {
        try {
            const { stationName } = request.query as unknown as IHandleGetBusStationByNameParams;

            if (!stationName) {
                response.status(400).json({ msg: "Missing required query parameters" });
                return;
            }

            const stations: IStation[] = await StationByNameService.getStationByName(stationName).then(async (getStationByNameResponse) => {
                return await Promise.all((getStationByNameResponse?.msgBody.itemList || []).map(async (stationInfo) => {
                    const stDir = await StationByUidItemService.getStationByUid(stationInfo.arsId).then((getStationByUidItemResponse) => {
                        const countingMap: { [key: string]: number } = {};
                        const maxRequency = { count: 0, nxtStn: "" };

                        (getStationByUidItemResponse?.msgBody.itemList || []).forEach((item) => {
                            if (countingMap[item.nxtStn] === undefined) countingMap[item.nxtStn] = 0;
                            if (++countingMap[item.nxtStn] > maxRequency.count) {
                                maxRequency.count = countingMap[item.nxtStn];
                                maxRequency.nxtStn = item.nxtStn;
                            }
                        });

                        return maxRequency.nxtStn;
                    });

                    return {
                        seq: "",
                        stDir: stDir,
                        stId: stationInfo.stId,
                        stNm: stationInfo.stNm,
                        tmX: stationInfo.tmX,
                        tmY: stationInfo.tmY,
                        posX: stationInfo.posX,
                        posY: stationInfo.posY,
                        arsId: stationInfo.arsId
                    };
                }));
            });

            console.log('BusStationByNameController.handleGetBusStationByName');
            console.log(stations);
            response.status(200).json({
                msg: "정상적으로 처리되었습니다.",
                data: { stations: stations }
            });

        } catch (error) {
            console.error(error);
            response.status(500).end(`${error}`);
        }
    }
}