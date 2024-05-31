import { NextApiRequest, NextApiResponse } from 'next';
import { BusPosByVehIdService } from '@/services/externalApi/datakr/BusPosByVehIdService';
import { IStationVisit } from '@/models/IStationVisit';


interface IHandleGetStationVisitParams {
    busRouteId: string | undefined;
    busVehId: string | undefined;
    fromStationSeq: string | undefined;
    toStationSeq: string | undefined;
}


export class StationVisitController {
    private constructor() { }


    public static async handleGetStationVisit(request: NextApiRequest, response: NextApiResponse): Promise<void> {
        try {
            const { busRouteId, busVehId, fromStationSeq, toStationSeq } = request.query as unknown as IHandleGetStationVisitParams;

            if (!busRouteId || !busVehId || !fromStationSeq || !toStationSeq) {
                response.status(400).json({ msg: "Missing required query parameters" });
                return;
            }

            const stationVisit: IStationVisit = await BusPosByVehIdService.getBusPosByVehId(busVehId).then((getBusPosByVehIdResponse) => {
                const currSeq = parseInt(getBusPosByVehIdResponse?.msgBody.itemList[0]?.stOrd || "-1");
                const startSeq = parseInt(fromStationSeq as string);
                const destinationSeq = parseInt(toStationSeq as string);
                const result = {
                    stationVisMsg: "운행종료",
                    stationOrd: "",
                }

                if (currSeq >= 0 && (startSeq <= currSeq && currSeq < destinationSeq)) {
                    const seqGap = destinationSeq - currSeq;
                    result.stationVisMsg = seqGap > 1 ? `${seqGap}개의 정류장이 남았습니다.` : '곧 도착합니다.';
                    result.stationOrd = currSeq.toString();
                }

                if (currSeq >= 0 && !(startSeq <= currSeq && currSeq < destinationSeq)) {
                    result.stationVisMsg = '목적지에 도착했습니다.';
                    result.stationOrd = currSeq.toString();
                }

                return result;
            });


            console.log('StationVisitController.handleGetStationVisit');
            console.log(stationVisit);
            response.status(200).json({
                msg: "정상적으로 처리되었습니다.",
                data: {
                    stationVisit: stationVisit
                }
            });

        } catch (error) {
            console.error(error);
            response.status(500).end(`${error}`);
        }
    }
}