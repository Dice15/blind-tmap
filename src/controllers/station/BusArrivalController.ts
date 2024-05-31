import { NextApiRequest, NextApiResponse } from 'next';
import { StationByUidItemService } from '@/services/externalApi/datakr/StationByUidItemService';
import { IBusArrival } from '@/models/IBusArrival';


interface IHandleGetBusArrivalParams {
    stationArsId: string | undefined;
    busRouteId: string | undefined;
}


export default class BusArrivalController {
    private constructor() { }


    public static async handleGetBusArrival(request: NextApiRequest, response: NextApiResponse): Promise<void> {
        try {
            const { stationArsId, busRouteId } = request.query as unknown as IHandleGetBusArrivalParams;

            if (!stationArsId || !busRouteId) {
                response.status(400).json({ msg: "Missing required query parameters" });
                return;
            }

            const busArrival: IBusArrival = await StationByUidItemService.getStationByUid(stationArsId).then((getStationByUidItemResponse) => {
                const busRouteInfo = getStationByUidItemResponse?.msgBody.itemList.find((busArrivalInfo) => busArrivalInfo.busRouteId === busRouteId);

                const result = {
                    busArrMsg1: "버스 운행이 종료되었습니다.",
                    busVehId1: "",
                    busArrMsg2: "",
                    busVehId2: "",
                }

                if (busRouteInfo && busRouteInfo.arrmsg1 !== "운행종료") {
                    const arrivalTime = busRouteInfo.arrmsg1.match(/\d+분\d+초후|곧 도착/);

                    if (!arrivalTime) {
                        result.busArrMsg1 = "버스 도착 정보가 없습니다.";
                    }
                    else if (arrivalTime[0] === "곧 도착") {
                        result.busArrMsg1 = "버스가 곧 도착 합니다.";
                        result.busVehId1 = busRouteInfo.vehId1;
                    }
                    else {
                        result.busArrMsg1 = `${arrivalTime[0]}에 도착합니다`;
                        result.busVehId1 = busRouteInfo.vehId1;
                    }
                }

                if (result.busVehId1 !== '' && busRouteInfo && busRouteInfo.arrmsg2 !== "운행종료") {
                    const arrivalTime = busRouteInfo.arrmsg2.match(/\d+분\d+초후/);

                    if (!arrivalTime) {
                        result.busArrMsg2 = "다음 버스는 도착 정보가 없습니다.";
                    }
                    else {
                        result.busArrMsg2 = `다음 버스는 ${arrivalTime[0]}에 도착합니다`;
                        result.busVehId2 = busRouteInfo.vehId2;
                    }
                }

                return result;
            })

            console.log('BusArrivalController.handleGetBusArrival');
            console.log(busArrival)
            response.status(200).json({
                msg: "정상적으로 처리되었습니다.",
                data: {
                    busArrival: busArrival
                }
            });
        } catch (error) {
            console.error(error);
            response.status(500).end(`${error}`);
        }
    }
}