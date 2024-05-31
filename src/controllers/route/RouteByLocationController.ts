import { NextApiRequest, NextApiResponse } from 'next';
import { IForwarding } from '@/models/IForwarding';
import { BusRouteListService } from '@/services/externalApi/datakr/BusRouteListService';
import { TransitRoutesService } from '@/services/externalApi/tamp/TransitRoutesService';
import { StaionByRouteService } from '@/services/externalApi/datakr/StaionByRouteService';
import { IRouting } from '@/models/IRouting';


interface IHandleGetBusArrivalParams {
    startX: string | undefined;
    startY: string | undefined;
    destinationX: string | undefined;
    destinationY: string | undefined;
};


export default class RouteByLocationController {
    private constructor() { }


    public static async handleGetRouteByLocation(request: NextApiRequest, response: NextApiResponse): Promise<void> {
        try {
            const { startX, startY, destinationX, destinationY } = request.query as unknown as IHandleGetBusArrivalParams;

            if (!startX || !startY || !destinationX || !destinationY) {
                response.status(400).json({ msg: "Missing required query parameters" });
                return;
            }

            const transitRoutes = await TransitRoutesService.getTransitRoutes(startX, startY, destinationX, destinationY).then((transitRoutesResponse) => {
                return transitRoutesResponse.metaData.plan.itineraries
                    .filter((itinerary) => {
                        return itinerary.pathType === 2;
                    })
                    .map((transitRoute) => {
                        transitRoute.legs = transitRoute.legs.filter((leg) => leg.mode === "BUS")
                        return transitRoute;
                    });
            });


            if (transitRoutes.length === 0) {
                response.status(200).json({
                    msg: "정상적으로 처리되었습니다.",
                    data: { transitRoute: null }
                });
            }
            else {
                const routings: IRouting[] = await Promise.all(transitRoutes.map(async (transitRoute) => {
                    const forwardings: IForwarding[] = await Promise.all(transitRoute.legs.map(async (leg) => {
                        const busRouteNm = leg.route!.split(':')[1];

                        const [stationNm, nextStationNm, lastStationNm] = [
                            leg.passStopList!.stationList[0].stationName,
                            leg.passStopList!.stationList[1].stationName,
                            leg.passStopList!.stationList[leg.passStopList!.stationList.length - 1].stationName,
                        ];

                        const busRoute = await BusRouteListService.getBusRouteList(busRouteNm).then((busRoutesResponse) => {
                            return busRoutesResponse?.msgBody.itemList.find((item) => item.busRouteNm === busRouteNm);
                        });


                        const station = await StaionByRouteService.getStaionByRoute(busRoute?.busRouteId || "").then((stationsResponse) => {
                            return stationsResponse?.msgBody.itemList.find((_, index) => {
                                return stationNm === (stationsResponse.msgBody.itemList[index].stationNm || "")
                                    && nextStationNm === (stationsResponse.msgBody.itemList[index + 1].stationNm) || "";
                            })
                        });

                        return (station?.arsId && busRoute?.busRouteId) ? {
                            fromStationNm: stationNm,
                            fromStationSeq: station.seq,
                            fromStationArsId: station.arsId,
                            toStationNm: lastStationNm,
                            toStationSeq: (parseInt(station.seq) + (leg.passStopList?.stationList.length || 1) - 1).toString(),
                            busRouteNm: busRouteNm,
                            busRouteId: busRoute.busRouteId,
                            busRouteDir: station.direction,
                        } : null;

                    })).then((forwardingsResponse) => forwardingsResponse.filter((value): value is IForwarding => value !== null));

                    return {
                        fare: transitRoute.fare.regular.totalFare.toString(),
                        time: transitRoute.totalTime.toString(),
                        forwarding: forwardings
                    };
                }))


                console.log('RouteByLocationController.handleGetRouteByLocation');
                console.log(routings)
                response.status(200).json({
                    msg: "정상적으로 처리되었습니다.",
                    data: {
                        routings: routings
                    }
                });
            }
        } catch (error) {
            console.error(error);
            response.status(500).end(`${error}`);
        }
    }
}
