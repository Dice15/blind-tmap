import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import axios from 'axios';
import { IStationVisit } from '@/core/type/IStationVisit';


export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const session = await getServerSession(request, response, authOptions);

    switch (request.method) {
        case "GET": {
            if (!session) {
                response.status(401).end('Unauthorized');
                return;
            }

            try {
                const { busRouteId, busVehId, fromStationSeq, toStationSeq } = request.query;
                const dataServiceKey = process.env.DATA_API_ENCODING_KEY2;

                if (!busRouteId || !busVehId || !fromStationSeq || !toStationSeq) {
                    response.status(400).json({ msg: "Missing required query parameters" });
                    return;
                }

                const stationVisit: IStationVisit = await axios.get<GetBusPosByVehIdResponse>(
                    "http://ws.bus.go.kr/api/rest/buspos/getBusPosByVehId", {
                    params: {
                        serviceKey: decodeURIComponent(dataServiceKey),
                        vehId: busVehId,
                        resultType: "json"
                    }
                }).then((getBusPosByVehIdResponse) => {
                    const currSeq = parseInt(getBusPosByVehIdResponse.data.msgBody.itemList[0]?.stOrd || "-1");
                    const startSeq = parseInt(fromStationSeq as string);
                    const destinationSeq = parseInt(toStationSeq as string);
                    const result = {
                        stationVisMsg: "운행종료",
                        stationOrd: "",
                    }

                    console.log(getBusPosByVehIdResponse.data.msgBody.itemList[0])

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

                console.log(stationVisit)

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
            break;
        }
        default: {
            response.setHeader('Allow', ['GET']);
            response.status(405).end(`Method ${request.method} Not Allowed`);
        }
    }
}


interface GetStaionByRouteResponse {
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
    busRouteId: string;
    busRouteNm: string;
    busRouteAbrv: string;
    seq: string;
    section: string;
    station: string;
    arsId: string;
    stationNm: string;
    gpsX: string;
    gpsY: string;
    posX: string;
    posY: string;
    fullSectDist: string;
    direction: string;
    stationNo: string;
    routeType: string;
    beginTm: string;
    lastTm: string;
    trnstnid: string;
    sectSpd: string;
    transYn: string;
}


interface GetBusPosByVehIdResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: {
        itemList: BusPosition[];
    };
}


interface BusPosition {
    vehId: string;
    stId: string;
    stOrd: string;
    stopFlag: string;
    dataTm: string;
    tmX: string;
    tmY: string;
    posX: string;
    posY: string;
    plainNo: string;
    busType: string;
    lastStnId: string;
    isFullFlag: string;
    congetion: string;
}


interface GetStationByUidItemApiResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: {
        itemList: StationByUidItem[];
    };
}


interface StationByUidItem {
    stId: string;
    stNm: string;
    arsId: string;
    busRouteId: string;
    rtNm: string;
    busRouteAbrv: string;
    sectNm: string;
    gpsX: string;
    gpsY: string;
    posX: string;
    posY: string;
    stationTp: string;
    firstTm: string;
    lastTm: string;
    term: string;
    routeType: string;
    nextBus: string;
    staOrd: string;
    vehId1: string;
    plainNo1: string | null;
    sectOrd1: string;
    stationNm1: string;
    traTime1: string;
    traSpd1: string;
    isArrive1: string;
    repTm1: string | null;
    isLast1: string;
    busType1: string;
    vehId2: string;
    plainNo2: string | null;
    sectOrd2: string;
    stationNm2: string;
    traTime2: string;
    traSpd2: string;
    isArrive2: string;
    repTm2: string | null;
    isLast2: string;
    busType2: string;
    adirection: string;
    arrmsg1: string;
    arrmsg2: string;
    arrmsgSec1: string;
    arrmsgSec2: string;
    nxtStn: string;
    rerdieDiv1: string;
    rerdieDiv2: string;
    rerideNum1: string;
    rerideNum2: string;
    isFullFlag1: string;
    isFullFlag2: string;
    deTourAt: string;
    congestion1: string;
    congestion2: string;
}