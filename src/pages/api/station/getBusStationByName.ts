import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import axios from 'axios';


export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const session = await getServerSession(request, response, authOptions);

    switch (request.method) {
        case "GET": {
            if (!session) {
                response.status(401).end('Unauthorized');
                return;
            }

            try {
                const requestParam = request.query;
                const stationName = requestParam.stationName as string;
                const dataServiceKey = process.env.DATA_API_ENCODING_KEY4;

                const stations = await axios.get<GetStationByNameResponse>(
                    "http://ws.bus.go.kr/api/rest/stationinfo/getStationByName", {
                    params: {
                        serviceKey: decodeURIComponent(dataServiceKey),
                        stSrch: stationName,
                        resultType: "json"
                    }
                }).then(async (getStationByNameResponse) => {
                    return await Promise.all(getStationByNameResponse.data.msgBody.itemList.map(async (stationInfo) => {
                        return {
                            ...stationInfo,
                            seq: "",
                            stDir: await axios.get<GetStationByUidItemResponse>(
                                "http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid", {
                                params: {
                                    serviceKey: decodeURIComponent(dataServiceKey),
                                    arsId: stationInfo.arsId,
                                    resultType: "json"
                                }
                            }).then((getStationByUidItemResponse) => {
                                const countingMap: { [key in string]: number; } = {};
                                const maxRequency = { count: 0, nxtStn: "" }

                                getStationByUidItemResponse.data.msgBody.itemList.forEach((item) => {
                                    if (countingMap[item.nxtStn] === undefined) countingMap[item.nxtStn] = 0;
                                    if (++countingMap[item.nxtStn] > maxRequency.count) {
                                        maxRequency.count = countingMap[item.nxtStn];
                                        maxRequency.nxtStn = item.nxtStn;
                                    }
                                });

                                return maxRequency.nxtStn;
                            })
                        }
                    }))
                });

                console.log(stations);

                response.status(200).json({
                    msg: "정상적으로 처리되었습니다.",
                    data: { stations: stations }
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

interface GetStationByUidItemResponse {
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