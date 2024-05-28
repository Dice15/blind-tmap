import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import axios from 'axios';
import { IForwarding } from '@/core/type/IForwarding';
import { IRouting } from '@/core/type/IRouting';


export default async function handler(request: NextApiRequest, response: NextApiResponse) {
    const session = await getServerSession(request, response, authOptions);

    switch (request.method) {
        case "GET": {
            if (!session) {
                response.status(401).end('Unauthorized');
                return;
            }

            const { startX, startY, destinationX, destinationY } = request.query;
            const dataServiceKey = process.env.DATA_API_ENCODING_KEY4;

            if (!startX || !startY || !destinationX || !destinationY) {
                response.status(400).json({ msg: "Missing required query parameters" });
                return;
            }

            try {
                const transitRoutes = getTransitRoutes().metaData.plan.itineraries
                    .filter((itinerary) => {
                        return itinerary.pathType === 2;
                    })
                    .map((transitRoute) => {
                        transitRoute.legs = transitRoute.legs.filter((leg) => leg.mode === "BUS")
                        return transitRoute;
                    });

                if (transitRoutes.length === 0) {
                    response.status(200).json({
                        msg: "정상적으로 처리되었습니다.",
                        data: { transitRoute: null }
                    });
                }
                else {
                    const routings: IRouting[] = await Promise.all(transitRoutes.map(async (transitRoute) => {
                        const forwardings: IForwarding[] = (await Promise.all(transitRoute.legs.map(async (leg) => {
                            const busRouteNm = leg.route!.split(':')[1];

                            const [stationNm, nextStationNm, lastStationNm] = [
                                leg.passStopList!.stationList[0].stationName,
                                leg.passStopList!.stationList[1].stationName,
                                leg.passStopList!.stationList[leg.passStopList!.stationList.length - 1].stationName,
                            ];

                            const busRoute = (await axios.get<GetBusRouteListResponse>(
                                "http://ws.bus.go.kr/api/rest/busRouteInfo/getBusRouteList", {
                                params: {
                                    serviceKey: decodeURIComponent(dataServiceKey),
                                    stSrch: busRouteNm,
                                    resultType: "json"
                                }
                            }).then((busRoutes) => {
                                return busRoutes.data.msgBody.itemList.find((item) => item.busRouteNm === busRouteNm);
                            }));

                            const station = (await axios.get<GetStaionByRouteResponse>(
                                "http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute", {
                                params: {
                                    serviceKey: decodeURIComponent(dataServiceKey),
                                    busRouteId: busRoute?.busRouteId || "",
                                    resultType: "json"
                                }
                            }).then((stations) => {
                                return stations.data.msgBody.itemList.find((_, index) =>
                                    (stationNm === (stations.data.msgBody.itemList[index].stationNm || "") && nextStationNm === (stations.data.msgBody.itemList[index + 1].stationNm) || ""));
                            }));

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
                        }))).filter((value): value is IForwarding => value !== null);

                        return {
                            fare: transitRoute.fare.regular.totalFare.toString(),
                            time: transitRoute.totalTime.toString(),
                            forwarding: forwardings
                        };
                    }));


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
            break;
        }
        default: {
            response.setHeader('Allow', ['GET']);
            response.status(405).end(`Method ${request.method} Not Allowed`);
        }
    }
}


interface GetTransitRoutesResponse {
    metaData: MetaData;
}

interface MetaData {
    requestParameters: RequestParameters;
    plan: Plan;
}

interface RequestParameters {
    busCount: number;
    expressbusCount: number;
    subwayCount: number;
    airplaneCount: number;
    locale: string;
    endY: string;
    endX: string;
    wideareaRouteCount: number;
    subwayBusCount: number;
    startY: string;
    startX: string;
    ferryCount: number;
    trainCount: number;
    reqDttm: string;
}

interface Plan {
    itineraries: Itinerary[];
}

interface Itinerary {
    fare: Fare;
    totalTime: number;
    legs: Leg[];
    totalWalkTime: number;
    transferCount: number;
    totalDistance: number;
    pathType: number;
    totalWalkDistance: number;
}

interface Fare {
    regular: RegularFare;
}

interface RegularFare {
    totalFare: number;
    currency: Currency;
}

interface Currency {
    symbol: string;
    currency: string;
    currencyCode: string;
}

interface Leg {
    mode: string;
    sectionTime: number;
    distance: number;
    start: Location;
    end: Location;
    steps?: Step[];
    routeColor?: string;
    Lane?: Lane[];
    type?: number;
    route?: string;
    routeId?: string;
    service?: number;
    passStopList?: PassStopList;
    passShape?: PassShape;
}

interface Location {
    name: string;
    lon: number;
    lat: number;
}

interface Step {
    streetName: string;
    distance: number;
    description: string;
    linestring: string;
}

interface Lane {
    routeColor: string;
    route: string;
    routeId: string;
    service: number;
    type: number;
}

interface PassStopList {
    stationList: Station[];
}

interface Station {
    index: number;
    stationName: string;
    lon: string;
    lat: string;
    stationID: string;
}

interface PassShape {
    linestring: string;
}

interface ComMsgHeader {
    errMsg: string | null;
    responseTime: string | null;
    responseMsgID: string | null;
    requestMsgID: string | null;
    returnCode: string | null;
    successYN: string | null;
}

interface MsgHeader {
    headerMsg: string;
    headerCd: string;
    itemCount: number;
}

interface GetBusRouteListResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: GetBusRouteListMsgBody;
}

interface GetBusRouteListMsgBody {
    itemList: GetBusRouteListItem[];
}

interface GetBusRouteListItem {
    busRouteId: string;
    busRouteNm: string;
    busRouteAbrv: string;
    length: string;
    routeType: string;
    stStationNm: string;
    edStationNm: string;
    term: string;
    lastBusYn: string;
    lastBusTm: string;
    firstBusTm: string;
    lastLowTm: string;
    firstLowTm: string;
    corpNm: string;
}

interface GetStaionByRouteResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: GetStaionByRouteMsgBody;
}

interface GetStaionByRouteMsgBody {
    itemList: GetStaionByRouteItem[];
}

interface GetStaionByRouteItem {
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





function getTransitRoutes(): GetTransitRoutesResponse {
    return {
        "metaData": {
            "requestParameters": {
                "busCount": 4,
                "expressbusCount": 0,
                "subwayCount": 5,
                "airplaneCount": 0,
                "locale": "ko",
                "endY": "37.5612375854",
                "endX": "126.9947285429",
                "wideareaRouteCount": 0,
                "subwayBusCount": 1,
                "startY": "37.653177207",
                "startX": "127.0507436148",
                "ferryCount": 0,
                "trainCount": 0,
                "reqDttm": "20240528221644"
            },
            "plan": {
                "itineraries": [
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1500,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 2316,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 642,
                                "distance": 764,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동",
                                    "lon": 127.04774722222223,
                                    "lat": 37.65320555555556
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 52,
                                        "description": "52m 이동",
                                        "linestring": "127.05074,37.653175 127.05066,37.65342 127.05059,37.653625"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 190,
                                        "description": "좌회전 후 190m 이동 ",
                                        "linestring": "127.05059,37.653625 127.05059,37.653633 127.05045,37.653675 127.05042,37.653687 127.04998,37.653572 127.04956,37.653492 127.049446,37.65345 127.04941,37.653435 127.048904,37.65332 127.04888,37.653316 127.04887,37.653347 127.04881,37.65348 127.04869,37.65345"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 191,
                                        "description": "지하보도 진입 후 191m 이동 ",
                                        "linestring": "127.04869,37.65345 127.04771,37.653217 127.04764,37.653202 127.046684,37.65298 127.046616,37.65297"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 158,
                                        "description": "동광교회 에서 우회전 후 158m 이동 ",
                                        "linestring": "127.046616,37.65297 127.04657,37.653053 127.04649,37.653255 127.04634,37.653614 127.04605,37.654324"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 14,
                                        "description": "훼미리마트 창동동아점 에서 우회전 후 14m 이동 ",
                                        "linestring": "127.04605,37.654324 127.046196,37.65436"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 84,
                                        "description": "훼미리마트 창동동아점 에서 우회전 후 84m 이동 ",
                                        "linestring": "127.046196,37.65436 127.04645,37.65379 127.0465,37.653725 127.046585,37.653744"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 75,
                                        "description": "금강한의원 에서 우회전 후 보행자도로 을 따라 75m 이동 ",
                                        "linestring": "127.046585,37.653744 127.046745,37.653305 127.04701,37.65337"
                                    }
                                ]
                            },
                            {
                                "routeColor": "00A5DE",
                                "distance": 13238,
                                "Lane": [
                                    {
                                        "routeColor": "00A5DE",
                                        "route": "수도권4호선(급행)",
                                        "routeId": "111041002",
                                        "service": 0,
                                        "type": 119
                                    }
                                ],
                                "start": {
                                    "name": "창동",
                                    "lon": 127.04774722222223,
                                    "lat": 37.65320555555556
                                },
                                "type": 4,
                                "mode": "SUBWAY",
                                "sectionTime": 1500,
                                "route": "수도권4호선",
                                "routeId": "110041030",
                                "service": 1,
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동",
                                            "lon": "127.047747",
                                            "lat": "37.653206",
                                            "stationID": "110407"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "쌍문",
                                            "lon": "127.034633",
                                            "lat": "37.648514",
                                            "stationID": "110408"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "수유(강북구청)",
                                            "lon": "127.025439",
                                            "lat": "37.637803",
                                            "stationID": "110409"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "미아",
                                            "lon": "127.026125",
                                            "lat": "37.626442",
                                            "stationID": "110410"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "미아사거리",
                                            "lon": "127.030094",
                                            "lat": "37.613239",
                                            "stationID": "110411"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "길음",
                                            "lon": "127.025064",
                                            "lat": "37.603458",
                                            "stationID": "110412"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "성신여대입구",
                                            "lon": "127.016522",
                                            "lat": "37.592706",
                                            "stationID": "110413"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "한성대입구",
                                            "lon": "127.006303",
                                            "lat": "37.588522",
                                            "stationID": "110414"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "혜화",
                                            "lon": "127.001772",
                                            "lat": "37.582689",
                                            "stationID": "110415"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "동대문",
                                            "lon": "127.009161",
                                            "lat": "37.571050",
                                            "stationID": "110416"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "동대문역사문화공원",
                                            "lon": "127.007356",
                                            "lat": "37.564644",
                                            "stationID": "110417"
                                        },
                                        {
                                            "index": 11,
                                            "stationName": "충무로",
                                            "lon": "126.994172",
                                            "lat": "37.561256",
                                            "stationID": "110418"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "충무로",
                                    "lon": 126.99417222222222,
                                    "lat": 37.561255555555555
                                },
                                "passShape": {
                                    "linestring": "127.047747,37.653203 127.046533,37.652922 127.046358,37.652881 127.042194,37.651900 127.041894,37.651825 127.041644,37.651772 127.041364,37.651731 127.040589,37.651653 127.036831,37.651383 127.036789,37.651381 127.036747,37.651378 127.036706,37.651369 127.036667,37.651364 127.036625,37.651356 127.036583,37.651344 127.036544,37.651331 127.036506,37.651317 127.036469,37.651303 127.036433,37.651286 127.036397,37.651267 127.036364,37.651250 127.036331,37.651228 127.036297,37.651206 127.036267,37.651181 127.036239,37.651158 127.036211,37.651131 127.036186,37.651106 127.036164,37.651078 127.036142,37.651050 127.036119,37.651019 127.034508,37.648306 127.034314,37.647978 127.032192,37.644414 127.031883,37.643953 127.031753,37.643775 127.031614,37.643603 127.031461,37.643433 127.031011,37.642997 127.027586,37.639806 127.026211,37.638519 127.025683,37.638025 127.025442,37.637800 127.023678,37.636158 127.023639,37.636117 127.023600,37.636075 127.023564,37.636031 127.023531,37.635989 127.023497,37.635942 127.023467,37.635894 127.023439,37.635850 127.023411,37.635803 127.023386,37.635753 127.023364,37.635703 127.023344,37.635656 127.023325,37.635606 127.023308,37.635553 127.023294,37.635503 127.023283,37.635453 127.023272,37.635400 127.023267,37.635350 127.023258,37.635297 127.023256,37.635244 127.023256,37.635192 127.023256,37.635139 127.023467,37.633225 127.023497,37.633078 127.023536,37.632939 127.023597,37.632764 127.024297,37.631053 127.025981,37.626789 127.026267,37.626092 127.026717,37.624994 127.029719,37.617503 127.029731,37.617469 127.029742,37.617433 127.029753,37.617400 127.029764,37.617367 127.029775,37.617333 127.029783,37.617300 127.029794,37.617264 127.029803,37.617231 127.029811,37.617194 127.029819,37.617161 127.029828,37.617125 127.029836,37.617092 127.029842,37.617056 127.029850,37.617022 127.029856,37.616989 127.029861,37.616953 127.029867,37.616917 127.029869,37.616883 127.029875,37.616847 127.029881,37.616814 127.029883,37.616778 127.030089,37.613319 127.030097,37.613239 127.030181,37.612358 127.030303,37.611303 127.030317,37.611122 127.030319,37.610881 127.030314,37.610656 127.030225,37.609453 127.030222,37.609411 127.030217,37.609369 127.030211,37.609328 127.030203,37.609289 127.030194,37.609247 127.030183,37.609206 127.030172,37.609164 127.030158,37.609125 127.030144,37.609083 127.030128,37.609044 127.030111,37.609006 127.030092,37.608967 127.030072,37.608928 127.030050,37.608889 127.030028,37.608853 127.030006,37.608814 127.029981,37.608778 127.029956,37.608742 127.029928,37.608706 127.029900,37.608669 127.029869,37.608636 127.029183,37.607872 127.028731,37.607353 127.028319,37.606925 127.027442,37.606106 127.026981,37.605708 127.025703,37.604708 127.025642,37.604661 127.025625,37.604650 127.025608,37.604633 127.025592,37.604619 127.025578,37.604606 127.025564,37.604592 127.025550,37.604578 127.025533,37.604561 127.025522,37.604544 127.025508,37.604531 127.025497,37.604514 127.025486,37.604497 127.025475,37.604481 127.025464,37.604464 127.025456,37.604444 127.025447,37.604428 127.025439,37.604411 127.025431,37.604392 127.025425,37.604375 127.025417,37.604356 127.025411,37.604339 127.025406,37.604319 127.025347,37.604081 127.025231,37.603789 127.024883,37.603103 127.024483,37.602314 127.024381,37.602161 127.024292,37.602050 127.024061,37.601822 127.023722,37.601558 127.022014,37.600267 127.021942,37.600183 127.021858,37.600025 127.021831,37.599931 127.021728,37.598031 127.021722,37.597917 127.021714,37.597803 127.021700,37.597689 127.021678,37.597575 127.021656,37.597464 127.021625,37.597350 127.021592,37.597242 127.021550,37.597131 127.021506,37.597022 127.021458,37.596914 127.021403,37.596808 127.021344,37.596706 127.021281,37.596603 127.021214,37.596503 127.021142,37.596403 127.021067,37.596308 127.020983,37.596214 127.020900,37.596122 127.020811,37.596031 127.020717,37.595944 127.020622,37.595861 127.017789,37.593419 127.017697,37.593342 127.017417,37.593142 127.017239,37.593039 127.016903,37.592867 127.016617,37.592736 127.016525,37.592703 127.016508,37.592694 127.016272,37.592628 127.015875,37.592558 127.015600,37.592517 127.014814,37.592425 127.014739,37.592414 127.014664,37.592403 127.014589,37.592389 127.014517,37.592375 127.014442,37.592358 127.014369,37.592342 127.014297,37.592325 127.014225,37.592306 127.014153,37.592286 127.014081,37.592264 127.014011,37.592242 127.013942,37.592219 127.013872,37.592194 127.013803,37.592167 127.013736,37.592142 127.013669,37.592114 127.013603,37.592083 127.013539,37.592053 127.013472,37.592019 127.013408,37.591989 127.013344,37.591956 127.011475,37.590908 127.011100,37.590708 127.010586,37.590453 127.010136,37.590236 127.006822,37.588744 127.006478,37.588592 127.006003,37.588400 127.005931,37.588375 127.004636,37.587928 127.003289,37.587450 127.003128,37.587381 127.002972,37.587303 127.002822,37.587219 127.002678,37.587131 127.002539,37.587033 127.002408,37.586931 127.002283,37.586825 127.002167,37.586711 127.002058,37.586592 127.001958,37.586469 127.001869,37.586342 127.001786,37.586214 127.001714,37.586078 127.001650,37.585942 127.001594,37.585803 127.001550,37.585661 127.001514,37.585517 127.001489,37.585372 127.001475,37.585228 127.001469,37.585081 127.001475,37.584933 127.001592,37.584000 127.001806,37.582694 127.002050,37.581203 127.002094,37.580794 127.002125,37.580439 127.002144,37.580078 127.002197,37.578119 127.002233,37.577917 127.002275,37.577722 127.002325,37.577514 127.002392,37.577278 127.002442,37.577103 127.002517,37.576922 127.002611,37.576736 127.002719,37.576569 127.002864,37.576425 127.003017,37.576331 127.003206,37.576258 127.003417,37.576181 127.003600,37.576133 127.003806,37.576075 127.003914,37.576044 127.004014,37.576011 127.004089,37.575994 127.004158,37.575975 127.004233,37.575956 127.004306,37.575936 127.004375,37.575917 127.004458,37.575883 127.004542,37.575847 127.004622,37.575808 127.004703,37.575769 127.004778,37.575725 127.004853,37.575681 127.004928,37.575636 127.005000,37.575586 127.005067,37.575536 127.005133,37.575483 127.005200,37.575431 127.005261,37.575375 127.005319,37.575317 127.005378,37.575258 127.005433,37.575197 127.005483,37.575136 127.008889,37.571453 127.008992,37.571308 127.009114,37.571139 127.009258,37.570911 127.009486,37.570547 127.009617,37.570203 127.009742,37.569244 127.009811,37.568661 127.009814,37.568617 127.009817,37.568575 127.009819,37.568528 127.009819,37.568483 127.009817,37.568442 127.009814,37.568397 127.009808,37.568353 127.009803,37.568308 127.009794,37.568264 127.009783,37.568219 127.009775,37.568178 127.009761,37.568133 127.009747,37.568092 127.009733,37.568050 127.009717,37.568006 127.009697,37.567964 127.009450,37.567483 127.009281,37.567164 127.009106,37.566825 127.008933,37.566497 127.008781,37.566247 127.008606,37.566017 127.008444,37.565839 127.007356,37.564644 127.007333,37.564619 127.007133,37.564350 127.007119,37.564331 127.007100,37.564311 127.007083,37.564292 127.007064,37.564272 127.007044,37.564256 127.007022,37.564239 127.007014,37.564231 127.007000,37.564219 127.006978,37.564206 127.006956,37.564189 127.006931,37.564175 127.006908,37.564158 127.006883,37.564147 127.006856,37.564133 127.006831,37.564122 127.006803,37.564111 127.006778,37.564100 127.006750,37.564092 127.006719,37.564081 127.006692,37.564075 127.006664,37.564067 127.006633,37.564058 127.006442,37.564022 127.005561,37.563858 127.004903,37.563719 126.995656,37.561569 126.994172,37.561256"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 174,
                                "distance": 179,
                                "start": {
                                    "name": "충무로",
                                    "lon": 126.99417222222222,
                                    "lat": 37.561255555555555
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 104,
                                        "description": "104m 이동",
                                        "linestring": "126.99417,37.561253 126.994255,37.56127 126.9943,37.56128 126.99529,37.561516"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 19,
                                        "description": "충무로역  8번출구 에서 우회전 후 19m 이동 ",
                                        "linestring": "126.99529,37.561516 126.99535,37.56135"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 38,
                                        "description": "방림꽃집 에서 우회전 후 38m 이동 ",
                                        "linestring": "126.99535,37.56135 126.99496,37.561275 126.99493,37.56128"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 18,
                                        "description": "충무로역  2번출구 에서 직진 후 퇴계로 을 따라 18m 이동 ",
                                        "linestring": "126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 816,
                        "transferCount": 0,
                        "totalDistance": 13553,
                        "pathType": 1,
                        "totalWalkDistance": 943
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1600,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 3092,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 169,
                                "distance": 222,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동",
                                    "lon": 127.04779166666667,
                                    "lat": 37.65311111111111
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 28,
                                        "description": "28m 이동",
                                        "linestring": "127.05074,37.653175 127.05066,37.65342"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 194,
                                        "description": "한솔교육 강북지점 에서 좌회전 후 194m 이동 ",
                                        "linestring": "127.05066,37.65342 127.04957,37.653164 127.04896,37.65302 127.04855,37.65292"
                                    }
                                ]
                            },
                            {
                                "routeColor": "0052A4",
                                "distance": 11052,
                                "Lane": [
                                    {
                                        "routeColor": "0052A4",
                                        "route": "수도권1호선(급행)",
                                        "routeId": "111011027",
                                        "service": 0,
                                        "type": 117
                                    }
                                ],
                                "start": {
                                    "name": "창동",
                                    "lon": 127.04779166666667,
                                    "lat": 37.65311111111111
                                },
                                "type": 1,
                                "mode": "SUBWAY",
                                "sectionTime": 1320,
                                "route": "수도권1호선",
                                "routeId": "110014032",
                                "service": 0,
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동",
                                            "lon": "127.047792",
                                            "lat": "37.653111",
                                            "stationID": "110117"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "녹천",
                                            "lon": "127.051344",
                                            "lat": "37.644733",
                                            "stationID": "110118"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "월계",
                                            "lon": "127.058797",
                                            "lat": "37.633233",
                                            "stationID": "110119"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "광운대",
                                            "lon": "127.061850",
                                            "lat": "37.623517",
                                            "stationID": "110120"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "석계",
                                            "lon": "127.065814",
                                            "lat": "37.614756",
                                            "stationID": "110121"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "신이문",
                                            "lon": "127.067433",
                                            "lat": "37.601928",
                                            "stationID": "110122"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "외대앞",
                                            "lon": "127.063628",
                                            "lat": "37.596211",
                                            "stationID": "110123"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "회기",
                                            "lon": "127.057953",
                                            "lat": "37.589808",
                                            "stationID": "110124"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "청량리",
                                            "lon": "127.044556",
                                            "lat": "37.579967",
                                            "stationID": "110125"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "제기동",
                                            "lon": "127.034792",
                                            "lat": "37.578169",
                                            "stationID": "110126"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "신설동",
                                            "lon": "127.024111",
                                            "lat": "37.575894",
                                            "stationID": "110127"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "신설동",
                                    "lon": 127.02411111111111,
                                    "lat": 37.575894444444444
                                },
                                "passShape": {
                                    "linestring": "127.047753,37.653203 127.050686,37.646347 127.051367,37.644742 127.052244,37.642672 127.052300,37.642572 127.052356,37.642472 127.052414,37.642375 127.052475,37.642278 127.052539,37.642181 127.052606,37.642086 127.052672,37.641992 127.052742,37.641897 127.052814,37.641806 127.052889,37.641714 127.052964,37.641622 127.053042,37.641533 127.053122,37.641444 127.053206,37.641358 127.053289,37.641275 127.053378,37.641189 127.053464,37.641106 127.053556,37.641025 127.053647,37.640944 127.056514,37.638639 127.056678,37.638506 127.056881,37.638353 127.057078,37.638192 127.057267,37.638025 127.057444,37.637850 127.057614,37.637669 127.057775,37.637486 127.057925,37.637297 127.058064,37.637103 127.058194,37.636903 127.058314,37.636700 127.058419,37.636492 127.058519,37.636281 127.058606,37.636067 127.058681,37.635853 127.058742,37.635633 127.058794,37.635414 127.058836,37.635192 127.058864,37.634967 127.058881,37.634744 127.058886,37.634519 127.058881,37.634294 127.058858,37.633231 127.058839,37.632172 127.058833,37.632047 127.058831,37.631919 127.058833,37.631794 127.058836,37.631669 127.058842,37.631544 127.058853,37.631417 127.058864,37.631292 127.058878,37.631167 127.058894,37.631042 127.058914,37.630917 127.058933,37.630792 127.058958,37.630667 127.058983,37.630542 127.059014,37.630419 127.059044,37.630294 127.059081,37.630172 127.059117,37.630050 127.059156,37.629928 127.059197,37.629806 127.059242,37.629686 127.059289,37.629567 127.059564,37.628881 127.061850,37.623517 127.061853,37.623508 127.061850,37.623517 127.062025,37.623103 127.062533,37.621978 127.063108,37.620797 127.063183,37.620650 127.063431,37.620097 127.063756,37.619350 127.064189,37.618381 127.064708,37.617217 127.065708,37.614989 127.065736,37.614928 127.066189,37.613922 127.067125,37.611847 127.067172,37.611728 127.067217,37.611606 127.067261,37.611483 127.067303,37.611361 127.067342,37.611239 127.067378,37.611117 127.067414,37.610992 127.067447,37.610867 127.067478,37.610742 127.067506,37.610619 127.067531,37.610492 127.067553,37.610367 127.067575,37.610242 127.067594,37.610117 127.067611,37.609989 127.067625,37.609864 127.067636,37.609739 127.067647,37.609611 127.067653,37.609483 127.067658,37.609358 127.067692,37.608158 127.067769,37.605672 127.067808,37.603806 127.067800,37.603644 127.067789,37.603483 127.067769,37.603319 127.067750,37.603158 127.067722,37.603000 127.067692,37.602839 127.067658,37.602681 127.067619,37.602519 127.067614,37.602494 127.067578,37.602364 127.067531,37.602206 127.067478,37.602047 127.067422,37.601892 127.067364,37.601739 127.067300,37.601583 127.067231,37.601431 127.067158,37.601281 127.067083,37.601131 127.067003,37.600981 127.066917,37.600833 127.066831,37.600689 127.066739,37.600542 127.065672,37.599031 127.064389,37.597275 127.063642,37.596206 127.063194,37.595564 127.061853,37.593592 127.061489,37.593056 127.060769,37.591925 127.060714,37.591844 127.060658,37.591767 127.060603,37.591689 127.060542,37.591611 127.060481,37.591536 127.060417,37.591461 127.060350,37.591386 127.060283,37.591314 127.060214,37.591242 127.060144,37.591172 127.060069,37.591103 127.059994,37.591033 127.059919,37.590967 127.059842,37.590903 127.059761,37.590836 127.059681,37.590775 127.059597,37.590711 127.059511,37.590653 127.059425,37.590592 127.059339,37.590533 127.059250,37.590478 127.057989,37.589772 127.057986,37.589769 127.057883,37.589714 127.055450,37.588400 127.054778,37.588031 127.054642,37.587953 127.054506,37.587872 127.054375,37.587792 127.054242,37.587708 127.054114,37.587622 127.053983,37.587536 127.053858,37.587447 127.053733,37.587356 127.053614,37.587264 127.053492,37.587169 127.053375,37.587075 127.053258,37.586978 127.053144,37.586878 127.053033,37.586778 127.052925,37.586675 127.052817,37.586572 127.052714,37.586467 127.052611,37.586358 127.052511,37.586253 127.052414,37.586142 127.051769,37.585333 127.051467,37.584972 127.051233,37.584692 127.050894,37.584297 127.050269,37.583539 127.049872,37.583233 127.049603,37.583003 127.049444,37.582861 127.049267,37.582722 127.048619,37.582206 127.048025,37.581708 127.047447,37.581336 127.046969,37.581072 127.046414,37.580767 127.045289,37.580189 127.045228,37.580158 127.044850,37.580056 127.044556,37.579967 127.039425,37.578372 127.039300,37.578336 127.039236,37.578319 127.039108,37.578289 127.038978,37.578258 127.038850,37.578236 127.038783,37.578225 127.038653,37.578206 127.038519,37.578192 127.038386,37.578181 127.038253,37.578175 127.038119,37.578169 127.038053,37.578169 127.036183,37.578183 127.034792,37.578169 127.032378,37.578142 127.032228,37.578133 127.032153,37.578128 127.032003,37.578114 127.031853,37.578094 127.031706,37.578072 127.031556,37.578047 127.031411,37.578017 127.031339,37.578000 127.031194,37.577967 127.031122,37.577947 127.030981,37.577908 127.030839,37.577864 127.027267,37.576822 127.025333,37.576289 127.024403,37.575994 127.024111,37.575894"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 163,
                                "distance": 173,
                                "start": {
                                    "name": "신설동",
                                    "lon": 127.02411111111111,
                                    "lat": 37.575894444444444
                                },
                                "end": {
                                    "name": "신설동역",
                                    "lon": 127.02570833333333,
                                    "lat": 37.576502777777776
                                },
                                "passShape": {
                                    "linestring": "127.024111,37.575894 127.024328,37.576006 127.024403,37.576025 127.024989,37.576183 127.024928,37.576331 127.025306,37.576428 127.025308,37.576444 127.025378,37.576461 127.025517,37.576500 127.025708,37.576503"
                                }
                            },
                            {
                                "mode": "BUS",
                                "routeColor": "0068B7",
                                "sectionTime": 1266,
                                "route": "간선:421",
                                "routeId": "11456001",
                                "distance": 3649,
                                "service": 1,
                                "start": {
                                    "name": "신설동역",
                                    "lon": 127.02570833333333,
                                    "lat": 37.576502777777776
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "신설동역",
                                            "lon": "127.025708",
                                            "lat": "37.576503",
                                            "stationID": "775296"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "신설동로터리.신한은행앞.서울풍물시장",
                                            "lon": "127.023150",
                                            "lat": "37.574189",
                                            "stationID": "775228"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "황학동롯데캐슬",
                                            "lon": "127.023281",
                                            "lat": "37.570875",
                                            "stationID": "775104"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "황학동주민센터",
                                            "lon": "127.023406",
                                            "lat": "37.566975",
                                            "stationID": "774989"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "성동고등학교",
                                            "lon": "127.022178",
                                            "lat": "37.565553",
                                            "stationID": "774935"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "신당역.중앙시장앞",
                                            "lon": "127.018733",
                                            "lat": "37.565764",
                                            "stationID": "774941"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "충무아트센터.스포츠센터.중부소방서",
                                            "lon": "127.013442",
                                            "lat": "37.565144",
                                            "stationID": "774914"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "광희문.광희동사거리",
                                            "lon": "127.008639",
                                            "lat": "37.564517",
                                            "stationID": "774894"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "퇴계로6가",
                                            "lon": "127.003264",
                                            "lat": "37.563497",
                                            "stationID": "774869"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "퇴계로5가",
                                            "lon": "126.999758",
                                            "lat": "37.562667",
                                            "stationID": "757851"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "충무로역8번출구.대한극장앞",
                                            "lon": "126.996542",
                                            "lat": "37.561922",
                                            "stationID": "757806"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "충무로역8번출구.대한극장앞",
                                    "lon": 126.99654166666667,
                                    "lat": 37.56192222222222
                                },
                                "type": 11,
                                "passShape": {
                                    "linestring": "127.025744,37.576481 127.025136,37.576308 127.024225,37.576033 127.023672,37.575850 127.023314,37.575700 127.023219,37.575606 127.023142,37.575464 127.023194,37.574200 127.023269,37.572386 127.023303,37.571503 127.023322,37.570892 127.023422,37.567833 127.023450,37.566972 127.023486,37.565917 127.023531,37.565258 127.023042,37.565342 127.022150,37.565525 127.021333,37.565692 127.020786,37.565761 127.020550,37.565769 127.018803,37.565736 127.018736,37.565728 127.016286,37.565453 127.016106,37.565431 127.013467,37.565114 127.012578,37.565008 127.011419,37.564956 127.010472,37.564792 127.008664,37.564486 127.007975,37.564369 127.007569,37.564308 127.007303,37.564303 127.007108,37.564286 127.005658,37.564008 127.003269,37.563461 127.002650,37.563319 127.001169,37.562975 127.000000,37.562683 126.999764,37.562631 126.998453,37.562331 126.996572,37.561894"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 174,
                                "distance": 204,
                                "start": {
                                    "name": "충무로역8번출구.대한극장앞",
                                    "lon": 126.99654166666667,
                                    "lat": 37.56192222222222
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 77,
                                        "description": "퇴계로 을 따라 77m 이동",
                                        "linestring": "126.99654,37.56194 126.99625,37.56187 126.9962,37.56186 126.99605,37.56182 126.995834,37.561768 126.9957,37.56173"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 31,
                                        "description": "서울이비인후과의원 에서 좌측 횡단보도 후 보행자도로 을 따라 31m 이동 ",
                                        "linestring": "126.9957,37.56173 126.99578,37.56146"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 96,
                                        "description": "충무로역  1번출구 에서 우회전 후 퇴계로 을 따라 96m 이동 ",
                                        "linestring": "126.99578,37.56146 126.99559,37.56142 126.99555,37.561413 126.995125,37.56132 126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 506,
                        "transferCount": 1,
                        "totalDistance": 15313,
                        "pathType": 3,
                        "totalWalkDistance": 599
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1500,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 3036,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 169,
                                "distance": 222,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동",
                                    "lon": 127.04779166666667,
                                    "lat": 37.65311111111111
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 28,
                                        "description": "28m 이동",
                                        "linestring": "127.05074,37.653175 127.05066,37.65342"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 194,
                                        "description": "한솔교육 강북지점 에서 좌회전 후 194m 이동 ",
                                        "linestring": "127.05066,37.65342 127.04957,37.653164 127.04896,37.65302 127.04855,37.65292"
                                    }
                                ]
                            },
                            {
                                "routeColor": "0052A4",
                                "distance": 13967,
                                "Lane": [
                                    {
                                        "routeColor": "0052A4",
                                        "route": "수도권1호선(급행)",
                                        "routeId": "111011027",
                                        "service": 0,
                                        "type": 117
                                    }
                                ],
                                "start": {
                                    "name": "창동",
                                    "lon": 127.04779166666667,
                                    "lat": 37.65311111111111
                                },
                                "type": 1,
                                "mode": "SUBWAY",
                                "sectionTime": 1800,
                                "route": "수도권1호선",
                                "routeId": "110014032",
                                "service": 0,
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동",
                                            "lon": "127.047792",
                                            "lat": "37.653111",
                                            "stationID": "110117"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "녹천",
                                            "lon": "127.051344",
                                            "lat": "37.644733",
                                            "stationID": "110118"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "월계",
                                            "lon": "127.058797",
                                            "lat": "37.633233",
                                            "stationID": "110119"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "광운대",
                                            "lon": "127.061850",
                                            "lat": "37.623517",
                                            "stationID": "110120"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "석계",
                                            "lon": "127.065814",
                                            "lat": "37.614756",
                                            "stationID": "110121"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "신이문",
                                            "lon": "127.067433",
                                            "lat": "37.601928",
                                            "stationID": "110122"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "외대앞",
                                            "lon": "127.063628",
                                            "lat": "37.596211",
                                            "stationID": "110123"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "회기",
                                            "lon": "127.057953",
                                            "lat": "37.589808",
                                            "stationID": "110124"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "청량리",
                                            "lon": "127.044556",
                                            "lat": "37.579967",
                                            "stationID": "110125"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "제기동",
                                            "lon": "127.034792",
                                            "lat": "37.578169",
                                            "stationID": "110126"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "신설동",
                                            "lon": "127.024111",
                                            "lat": "37.575894",
                                            "stationID": "110127"
                                        },
                                        {
                                            "index": 11,
                                            "stationName": "동묘앞",
                                            "lon": "127.016594",
                                            "lat": "37.573267",
                                            "stationID": "110128"
                                        },
                                        {
                                            "index": 12,
                                            "stationName": "동대문",
                                            "lon": "127.010639",
                                            "lat": "37.571675",
                                            "stationID": "110129"
                                        },
                                        {
                                            "index": 13,
                                            "stationName": "종로5가",
                                            "lon": "127.001942",
                                            "lat": "37.571008",
                                            "stationID": "110130"
                                        },
                                        {
                                            "index": 14,
                                            "stationName": "종로3가",
                                            "lon": "126.992206",
                                            "lat": "37.570436",
                                            "stationID": "110131"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "종로3가",
                                    "lon": 126.99220555555556,
                                    "lat": 37.570436111111114
                                },
                                "passShape": {
                                    "linestring": "127.047753,37.653203 127.050686,37.646347 127.051367,37.644742 127.052244,37.642672 127.052300,37.642572 127.052356,37.642472 127.052414,37.642375 127.052475,37.642278 127.052539,37.642181 127.052606,37.642086 127.052672,37.641992 127.052742,37.641897 127.052814,37.641806 127.052889,37.641714 127.052964,37.641622 127.053042,37.641533 127.053122,37.641444 127.053206,37.641358 127.053289,37.641275 127.053378,37.641189 127.053464,37.641106 127.053556,37.641025 127.053647,37.640944 127.056514,37.638639 127.056678,37.638506 127.056881,37.638353 127.057078,37.638192 127.057267,37.638025 127.057444,37.637850 127.057614,37.637669 127.057775,37.637486 127.057925,37.637297 127.058064,37.637103 127.058194,37.636903 127.058314,37.636700 127.058419,37.636492 127.058519,37.636281 127.058606,37.636067 127.058681,37.635853 127.058742,37.635633 127.058794,37.635414 127.058836,37.635192 127.058864,37.634967 127.058881,37.634744 127.058886,37.634519 127.058881,37.634294 127.058858,37.633231 127.058839,37.632172 127.058833,37.632047 127.058831,37.631919 127.058833,37.631794 127.058836,37.631669 127.058842,37.631544 127.058853,37.631417 127.058864,37.631292 127.058878,37.631167 127.058894,37.631042 127.058914,37.630917 127.058933,37.630792 127.058958,37.630667 127.058983,37.630542 127.059014,37.630419 127.059044,37.630294 127.059081,37.630172 127.059117,37.630050 127.059156,37.629928 127.059197,37.629806 127.059242,37.629686 127.059289,37.629567 127.059564,37.628881 127.061850,37.623517 127.061853,37.623508 127.061850,37.623517 127.062025,37.623103 127.062533,37.621978 127.063108,37.620797 127.063183,37.620650 127.063431,37.620097 127.063756,37.619350 127.064189,37.618381 127.064708,37.617217 127.065708,37.614989 127.065736,37.614928 127.066189,37.613922 127.067125,37.611847 127.067172,37.611728 127.067217,37.611606 127.067261,37.611483 127.067303,37.611361 127.067342,37.611239 127.067378,37.611117 127.067414,37.610992 127.067447,37.610867 127.067478,37.610742 127.067506,37.610619 127.067531,37.610492 127.067553,37.610367 127.067575,37.610242 127.067594,37.610117 127.067611,37.609989 127.067625,37.609864 127.067636,37.609739 127.067647,37.609611 127.067653,37.609483 127.067658,37.609358 127.067692,37.608158 127.067769,37.605672 127.067808,37.603806 127.067800,37.603644 127.067789,37.603483 127.067769,37.603319 127.067750,37.603158 127.067722,37.603000 127.067692,37.602839 127.067658,37.602681 127.067619,37.602519 127.067614,37.602494 127.067578,37.602364 127.067531,37.602206 127.067478,37.602047 127.067422,37.601892 127.067364,37.601739 127.067300,37.601583 127.067231,37.601431 127.067158,37.601281 127.067083,37.601131 127.067003,37.600981 127.066917,37.600833 127.066831,37.600689 127.066739,37.600542 127.065672,37.599031 127.064389,37.597275 127.063642,37.596206 127.063194,37.595564 127.061853,37.593592 127.061489,37.593056 127.060769,37.591925 127.060714,37.591844 127.060658,37.591767 127.060603,37.591689 127.060542,37.591611 127.060481,37.591536 127.060417,37.591461 127.060350,37.591386 127.060283,37.591314 127.060214,37.591242 127.060144,37.591172 127.060069,37.591103 127.059994,37.591033 127.059919,37.590967 127.059842,37.590903 127.059761,37.590836 127.059681,37.590775 127.059597,37.590711 127.059511,37.590653 127.059425,37.590592 127.059339,37.590533 127.059250,37.590478 127.057989,37.589772 127.057986,37.589769 127.057883,37.589714 127.055450,37.588400 127.054778,37.588031 127.054642,37.587953 127.054506,37.587872 127.054375,37.587792 127.054242,37.587708 127.054114,37.587622 127.053983,37.587536 127.053858,37.587447 127.053733,37.587356 127.053614,37.587264 127.053492,37.587169 127.053375,37.587075 127.053258,37.586978 127.053144,37.586878 127.053033,37.586778 127.052925,37.586675 127.052817,37.586572 127.052714,37.586467 127.052611,37.586358 127.052511,37.586253 127.052414,37.586142 127.051769,37.585333 127.051467,37.584972 127.051233,37.584692 127.050894,37.584297 127.050269,37.583539 127.049872,37.583233 127.049603,37.583003 127.049444,37.582861 127.049267,37.582722 127.048619,37.582206 127.048025,37.581708 127.047447,37.581336 127.046969,37.581072 127.046414,37.580767 127.045289,37.580189 127.045228,37.580158 127.044850,37.580056 127.044556,37.579967 127.039425,37.578372 127.039300,37.578336 127.039236,37.578319 127.039108,37.578289 127.038978,37.578258 127.038850,37.578236 127.038783,37.578225 127.038653,37.578206 127.038519,37.578192 127.038386,37.578181 127.038253,37.578175 127.038119,37.578169 127.038053,37.578169 127.036183,37.578183 127.034792,37.578169 127.032378,37.578142 127.032228,37.578133 127.032153,37.578128 127.032003,37.578114 127.031853,37.578094 127.031706,37.578072 127.031556,37.578047 127.031411,37.578017 127.031339,37.578000 127.031194,37.577967 127.031122,37.577947 127.030981,37.577908 127.030839,37.577864 127.027267,37.576822 127.025333,37.576289 127.024403,37.575994 127.024111,37.575894 127.023575,37.575708 127.023411,37.575644 127.023233,37.575572 127.021017,37.574692 127.020608,37.574539 127.018425,37.573794 127.018194,37.573719 127.017964,37.573644 127.017731,37.573572 127.017500,37.573503 127.017108,37.573392 127.016603,37.573250 127.015642,37.572981 127.013144,37.572283 127.012953,37.572225 127.012806,37.572181 127.012611,37.572125 127.012464,37.572089 127.012317,37.572050 127.012117,37.572006 127.010636,37.571681 127.010056,37.571553 127.009900,37.571528 127.009794,37.571508 127.009689,37.571486 127.009533,37.571453 127.009378,37.571417 127.009225,37.571375 127.009072,37.571331 127.008992,37.571308 127.008872,37.571269 127.008722,37.571231 127.008619,37.571208 127.008517,37.571189 127.008414,37.571169 127.008308,37.571156 127.008206,37.571142 127.008100,37.571133 127.007994,37.571128 127.007889,37.571125 127.002889,37.571017 127.002136,37.571003 127.001483,37.570983 127.001083,37.570958 127.000419,37.570917 126.997889,37.570747 126.997125,37.570689 126.994897,37.570522 126.992206,37.570436"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 1067,
                                "distance": 1263,
                                "start": {
                                    "name": "종로3가",
                                    "lon": 126.99220555555556,
                                    "lat": 37.570436111111114
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 35,
                                        "description": "35m 이동",
                                        "linestring": "126.9922,37.57045 126.99223,37.57045 126.9926,37.57046"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 15,
                                        "description": "종로3가역 13번출구 에서 우회전 후 15m 이동 ",
                                        "linestring": "126.9926,37.57046 126.992615,37.570328"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 21,
                                        "description": "종로3가역 13번출구 에서 우회전 후 21m 이동 ",
                                        "linestring": "126.992615,37.570328 126.99241,37.57032 126.99238,37.570305"
                                    },
                                    {
                                        "streetName": "종로",
                                        "distance": 6,
                                        "description": "종로3가역 13번출구 에서 직진 후 종로 을 따라 6m 이동 ",
                                        "linestring": "126.99238,37.570305 126.99236,37.570305 126.992325,37.57028"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 19,
                                        "description": "백두공구 에서 횡단보도 후 보행자도로 을 따라 19m 이동 ",
                                        "linestring": "126.99247,37.568645 126.99249,37.568478"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 26,
                                        "description": "서울자석 에서 우회전 후 26m 이동 ",
                                        "linestring": "126.99249,37.568478 126.99247,37.568474 126.99243,37.56847 126.992455,37.568283"
                                    },
                                    {
                                        "streetName": "청계천로",
                                        "distance": 6,
                                        "description": "직진 후 청계천로 을 따라 6m 이동 ",
                                        "linestring": "126.992455,37.568283 126.99252,37.568287"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 17,
                                        "description": "횡단보도 후 보행자도로 을 따라 17m 이동 ",
                                        "linestring": "126.99252,37.568287 126.99253,37.568134"
                                    },
                                    {
                                        "streetName": "충무로",
                                        "distance": 176,
                                        "description": "평안상사 에서 직진 후 충무로 을 따라 176m 이동 ",
                                        "linestring": "126.99253,37.568134 126.992516,37.568123 126.99252,37.56808 126.99255,37.567783 126.99259,37.56746 126.992615,37.56729 126.992645,37.56699 126.992676,37.566742 126.99269,37.566578 126.99271,37.566566"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 32,
                                        "description": "을지로3가역  6번출구 에서 우측 횡단보도 후 보행자도로 을 따라 32m 이동 ",
                                        "linestring": "126.992775,37.56652 126.992805,37.566235"
                                    },
                                    {
                                        "streetName": "충무로",
                                        "distance": 199,
                                        "description": "을지로3가파출소 에서 직진 후 충무로 을 따라 199m 이동 ",
                                        "linestring": "126.992805,37.566235 126.992744,37.566166 126.992744,37.566135 126.99277,37.565956 126.992805,37.56564 126.99286,37.565224 126.99288,37.565002 126.99294,37.564537 126.99294,37.564507 126.99296,37.564487 126.99297,37.564472"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 16,
                                        "description": "명보치과의원 에서 횡단보도 후 보행자도로 을 따라 16m 이동 ",
                                        "linestring": "126.99307,37.564445 126.99309,37.5643"
                                    },
                                    {
                                        "streetName": "마른내로",
                                        "distance": 5,
                                        "description": "이디야 명보점 에서 직진 후 마른내로 을 따라 5m 이동 ",
                                        "linestring": "126.99309,37.5643 126.993065,37.5643 126.99304,37.56428"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 31,
                                        "description": "충무로믿음치과의원 에서 횡단보도 후 보행자도로 을 따라 31m 이동 ",
                                        "linestring": "126.99349,37.561253 126.99355,37.56098"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 107,
                                        "description": "충무로역  3번출구 에서 좌회전 후 퇴계로 을 따라 107m 이동 ",
                                        "linestring": "126.99355,37.56098 126.99361,37.560993 126.99365,37.561005 126.99391,37.561058 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 1236,
                        "transferCount": 0,
                        "totalDistance": 15276,
                        "pathType": 1,
                        "totalWalkDistance": 1485
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1500,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 3113,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 642,
                                "distance": 764,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동",
                                    "lon": 127.04774722222223,
                                    "lat": 37.65320555555556
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 52,
                                        "description": "52m 이동",
                                        "linestring": "127.05074,37.653175 127.05066,37.65342 127.05059,37.653625"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 190,
                                        "description": "좌회전 후 190m 이동 ",
                                        "linestring": "127.05059,37.653625 127.05059,37.653633 127.05045,37.653675 127.05042,37.653687 127.04998,37.653572 127.04956,37.653492 127.049446,37.65345 127.04941,37.653435 127.048904,37.65332 127.04888,37.653316 127.04887,37.653347 127.04881,37.65348 127.04869,37.65345"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 191,
                                        "description": "지하보도 진입 후 191m 이동 ",
                                        "linestring": "127.04869,37.65345 127.04771,37.653217 127.04764,37.653202 127.046684,37.65298 127.046616,37.65297"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 158,
                                        "description": "동광교회 에서 우회전 후 158m 이동 ",
                                        "linestring": "127.046616,37.65297 127.04657,37.653053 127.04649,37.653255 127.04634,37.653614 127.04605,37.654324"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 14,
                                        "description": "훼미리마트 창동동아점 에서 우회전 후 14m 이동 ",
                                        "linestring": "127.04605,37.654324 127.046196,37.65436"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 84,
                                        "description": "훼미리마트 창동동아점 에서 우회전 후 84m 이동 ",
                                        "linestring": "127.046196,37.65436 127.04645,37.65379 127.0465,37.653725 127.046585,37.653744"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 75,
                                        "description": "금강한의원 에서 우회전 후 보행자도로 을 따라 75m 이동 ",
                                        "linestring": "127.046585,37.653744 127.046745,37.653305 127.04701,37.65337"
                                    }
                                ]
                            },
                            {
                                "routeColor": "00A5DE",
                                "distance": 12014,
                                "Lane": [
                                    {
                                        "routeColor": "00A5DE",
                                        "route": "수도권4호선(급행)",
                                        "routeId": "111041002",
                                        "service": 0,
                                        "type": 119
                                    }
                                ],
                                "start": {
                                    "name": "창동",
                                    "lon": 127.04774722222223,
                                    "lat": 37.65320555555556
                                },
                                "type": 4,
                                "mode": "SUBWAY",
                                "sectionTime": 1322,
                                "route": "수도권4호선",
                                "routeId": "110041030",
                                "service": 1,
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동",
                                            "lon": "127.047747",
                                            "lat": "37.653206",
                                            "stationID": "110407"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "쌍문",
                                            "lon": "127.034633",
                                            "lat": "37.648514",
                                            "stationID": "110408"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "수유(강북구청)",
                                            "lon": "127.025439",
                                            "lat": "37.637803",
                                            "stationID": "110409"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "미아",
                                            "lon": "127.026125",
                                            "lat": "37.626442",
                                            "stationID": "110410"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "미아사거리",
                                            "lon": "127.030094",
                                            "lat": "37.613239",
                                            "stationID": "110411"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "길음",
                                            "lon": "127.025064",
                                            "lat": "37.603458",
                                            "stationID": "110412"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "성신여대입구",
                                            "lon": "127.016522",
                                            "lat": "37.592706",
                                            "stationID": "110413"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "한성대입구",
                                            "lon": "127.006303",
                                            "lat": "37.588522",
                                            "stationID": "110414"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "혜화",
                                            "lon": "127.001772",
                                            "lat": "37.582689",
                                            "stationID": "110415"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "동대문",
                                            "lon": "127.009161",
                                            "lat": "37.571050",
                                            "stationID": "110416"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "동대문역사문화공원",
                                            "lon": "127.007356",
                                            "lat": "37.564644",
                                            "stationID": "110417"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00735555555555,
                                    "lat": 37.56464444444445
                                },
                                "passShape": {
                                    "linestring": "127.047747,37.653203 127.046533,37.652922 127.046358,37.652881 127.042194,37.651900 127.041894,37.651825 127.041644,37.651772 127.041364,37.651731 127.040589,37.651653 127.036831,37.651383 127.036789,37.651381 127.036747,37.651378 127.036706,37.651369 127.036667,37.651364 127.036625,37.651356 127.036583,37.651344 127.036544,37.651331 127.036506,37.651317 127.036469,37.651303 127.036433,37.651286 127.036397,37.651267 127.036364,37.651250 127.036331,37.651228 127.036297,37.651206 127.036267,37.651181 127.036239,37.651158 127.036211,37.651131 127.036186,37.651106 127.036164,37.651078 127.036142,37.651050 127.036119,37.651019 127.034508,37.648306 127.034314,37.647978 127.032192,37.644414 127.031883,37.643953 127.031753,37.643775 127.031614,37.643603 127.031461,37.643433 127.031011,37.642997 127.027586,37.639806 127.026211,37.638519 127.025683,37.638025 127.025442,37.637800 127.023678,37.636158 127.023639,37.636117 127.023600,37.636075 127.023564,37.636031 127.023531,37.635989 127.023497,37.635942 127.023467,37.635894 127.023439,37.635850 127.023411,37.635803 127.023386,37.635753 127.023364,37.635703 127.023344,37.635656 127.023325,37.635606 127.023308,37.635553 127.023294,37.635503 127.023283,37.635453 127.023272,37.635400 127.023267,37.635350 127.023258,37.635297 127.023256,37.635244 127.023256,37.635192 127.023256,37.635139 127.023467,37.633225 127.023497,37.633078 127.023536,37.632939 127.023597,37.632764 127.024297,37.631053 127.025981,37.626789 127.026267,37.626092 127.026717,37.624994 127.029719,37.617503 127.029731,37.617469 127.029742,37.617433 127.029753,37.617400 127.029764,37.617367 127.029775,37.617333 127.029783,37.617300 127.029794,37.617264 127.029803,37.617231 127.029811,37.617194 127.029819,37.617161 127.029828,37.617125 127.029836,37.617092 127.029842,37.617056 127.029850,37.617022 127.029856,37.616989 127.029861,37.616953 127.029867,37.616917 127.029869,37.616883 127.029875,37.616847 127.029881,37.616814 127.029883,37.616778 127.030089,37.613319 127.030097,37.613239 127.030181,37.612358 127.030303,37.611303 127.030317,37.611122 127.030319,37.610881 127.030314,37.610656 127.030225,37.609453 127.030222,37.609411 127.030217,37.609369 127.030211,37.609328 127.030203,37.609289 127.030194,37.609247 127.030183,37.609206 127.030172,37.609164 127.030158,37.609125 127.030144,37.609083 127.030128,37.609044 127.030111,37.609006 127.030092,37.608967 127.030072,37.608928 127.030050,37.608889 127.030028,37.608853 127.030006,37.608814 127.029981,37.608778 127.029956,37.608742 127.029928,37.608706 127.029900,37.608669 127.029869,37.608636 127.029183,37.607872 127.028731,37.607353 127.028319,37.606925 127.027442,37.606106 127.026981,37.605708 127.025703,37.604708 127.025642,37.604661 127.025625,37.604650 127.025608,37.604633 127.025592,37.604619 127.025578,37.604606 127.025564,37.604592 127.025550,37.604578 127.025533,37.604561 127.025522,37.604544 127.025508,37.604531 127.025497,37.604514 127.025486,37.604497 127.025475,37.604481 127.025464,37.604464 127.025456,37.604444 127.025447,37.604428 127.025439,37.604411 127.025431,37.604392 127.025425,37.604375 127.025417,37.604356 127.025411,37.604339 127.025406,37.604319 127.025347,37.604081 127.025231,37.603789 127.024883,37.603103 127.024483,37.602314 127.024381,37.602161 127.024292,37.602050 127.024061,37.601822 127.023722,37.601558 127.022014,37.600267 127.021942,37.600183 127.021858,37.600025 127.021831,37.599931 127.021728,37.598031 127.021722,37.597917 127.021714,37.597803 127.021700,37.597689 127.021678,37.597575 127.021656,37.597464 127.021625,37.597350 127.021592,37.597242 127.021550,37.597131 127.021506,37.597022 127.021458,37.596914 127.021403,37.596808 127.021344,37.596706 127.021281,37.596603 127.021214,37.596503 127.021142,37.596403 127.021067,37.596308 127.020983,37.596214 127.020900,37.596122 127.020811,37.596031 127.020717,37.595944 127.020622,37.595861 127.017789,37.593419 127.017697,37.593342 127.017417,37.593142 127.017239,37.593039 127.016903,37.592867 127.016617,37.592736 127.016525,37.592703 127.016508,37.592694 127.016272,37.592628 127.015875,37.592558 127.015600,37.592517 127.014814,37.592425 127.014739,37.592414 127.014664,37.592403 127.014589,37.592389 127.014517,37.592375 127.014442,37.592358 127.014369,37.592342 127.014297,37.592325 127.014225,37.592306 127.014153,37.592286 127.014081,37.592264 127.014011,37.592242 127.013942,37.592219 127.013872,37.592194 127.013803,37.592167 127.013736,37.592142 127.013669,37.592114 127.013603,37.592083 127.013539,37.592053 127.013472,37.592019 127.013408,37.591989 127.013344,37.591956 127.011475,37.590908 127.011100,37.590708 127.010586,37.590453 127.010136,37.590236 127.006822,37.588744 127.006478,37.588592 127.006003,37.588400 127.005931,37.588375 127.004636,37.587928 127.003289,37.587450 127.003128,37.587381 127.002972,37.587303 127.002822,37.587219 127.002678,37.587131 127.002539,37.587033 127.002408,37.586931 127.002283,37.586825 127.002167,37.586711 127.002058,37.586592 127.001958,37.586469 127.001869,37.586342 127.001786,37.586214 127.001714,37.586078 127.001650,37.585942 127.001594,37.585803 127.001550,37.585661 127.001514,37.585517 127.001489,37.585372 127.001475,37.585228 127.001469,37.585081 127.001475,37.584933 127.001592,37.584000 127.001806,37.582694 127.002050,37.581203 127.002094,37.580794 127.002125,37.580439 127.002144,37.580078 127.002197,37.578119 127.002233,37.577917 127.002275,37.577722 127.002325,37.577514 127.002392,37.577278 127.002442,37.577103 127.002517,37.576922 127.002611,37.576736 127.002719,37.576569 127.002864,37.576425 127.003017,37.576331 127.003206,37.576258 127.003417,37.576181 127.003600,37.576133 127.003806,37.576075 127.003914,37.576044 127.004014,37.576011 127.004089,37.575994 127.004158,37.575975 127.004233,37.575956 127.004306,37.575936 127.004375,37.575917 127.004458,37.575883 127.004542,37.575847 127.004622,37.575808 127.004703,37.575769 127.004778,37.575725 127.004853,37.575681 127.004928,37.575636 127.005000,37.575586 127.005067,37.575536 127.005133,37.575483 127.005200,37.575431 127.005261,37.575375 127.005319,37.575317 127.005378,37.575258 127.005433,37.575197 127.005483,37.575136 127.008889,37.571453 127.008992,37.571308 127.009114,37.571139 127.009258,37.570911 127.009486,37.570547 127.009617,37.570203 127.009742,37.569244 127.009811,37.568661 127.009814,37.568617 127.009817,37.568575 127.009819,37.568528 127.009819,37.568483 127.009817,37.568442 127.009814,37.568397 127.009808,37.568353 127.009803,37.568308 127.009794,37.568264 127.009783,37.568219 127.009775,37.568178 127.009761,37.568133 127.009747,37.568092 127.009733,37.568050 127.009717,37.568006 127.009697,37.567964 127.009450,37.567483 127.009281,37.567164 127.009106,37.566825 127.008933,37.566497 127.008781,37.566247 127.008606,37.566017 127.008444,37.565839 127.007356,37.564644"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 206,
                                "distance": 255,
                                "start": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00735555555555,
                                    "lat": 37.56464444444445
                                },
                                "end": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00888611111111,
                                    "lat": 37.56569722222222
                                },
                                "passShape": {
                                    "linestring": "127.007356,37.564644 127.007281,37.564508 127.007428,37.564425 127.007717,37.564403 127.007728,37.564414 127.007767,37.564408 127.007839,37.564406 127.007933,37.564419 127.008203,37.564467 127.008522,37.564517 127.008531,37.564778 127.008536,37.565000 127.008550,37.565053 127.008569,37.565103 127.008675,37.565294 127.008781,37.565475 127.008836,37.565578 127.008886,37.565697"
                                }
                            },
                            {
                                "mode": "SUBWAY",
                                "routeColor": "009D3E",
                                "sectionTime": 196,
                                "route": "수도권2호선",
                                "routeId": "110021018",
                                "distance": 1593,
                                "service": 1,
                                "start": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00888611111111,
                                    "lat": 37.56569722222222
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "동대문역사문화공원",
                                            "lon": "127.008886",
                                            "lat": "37.565697",
                                            "stationID": "110205"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "을지로4가",
                                            "lon": "126.998094",
                                            "lat": "37.566642",
                                            "stationID": "110204"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "을지로3가",
                                            "lon": "126.990928",
                                            "lat": "37.566286",
                                            "stationID": "110203"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "을지로3가",
                                    "lon": 126.99092777777778,
                                    "lat": 37.56628611111111
                                },
                                "type": 2,
                                "passShape": {
                                    "linestring": "127.008886,37.565697 127.008444,37.565839 127.008264,37.565894 127.008003,37.565961 127.007567,37.566058 127.007164,37.566136 127.006494,37.566247 127.005875,37.566353 127.002844,37.566858 127.002733,37.566869 127.002614,37.566878 127.002478,37.566881 126.998683,37.566669 126.998153,37.566642 126.997886,37.566631 126.997711,37.566619 126.995494,37.566508 126.992633,37.566381 126.992628,37.566381 126.990928,37.566300"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 747,
                                "distance": 901,
                                "start": {
                                    "name": "을지로3가",
                                    "lon": 126.99092777777778,
                                    "lat": 37.56628611111111
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 135,
                                        "description": "135m 이동",
                                        "linestring": "126.99093,37.566284 126.99097,37.566284 126.992455,37.56636"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 31,
                                        "description": "을지로3가역 10번출구 에서 우회전 후 31m 이동 ",
                                        "linestring": "126.992455,37.56636 126.992455,37.566246 126.99226,37.56624 126.992256,37.566227"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 9,
                                        "description": "을지로3가역 10번출구 에서 좌회전 후 9m 이동 ",
                                        "linestring": "126.992256,37.566227 126.992355,37.56624"
                                    },
                                    {
                                        "streetName": "을지로",
                                        "distance": 8,
                                        "description": "우회전 후 을지로 을 따라 8m 이동 ",
                                        "linestring": "126.992355,37.56624 126.9924,37.566242 126.99243,37.566216"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 41,
                                        "description": "오모리찌개 에서 좌측 횡단보도 후 보행자도로 을 따라 41m 이동 ",
                                        "linestring": "126.9927,37.564526 126.99288,37.564377 126.99304,37.56428"
                                    },
                                    {
                                        "streetName": "충무로",
                                        "distance": 348,
                                        "description": "이디야 명보점 에서 우회전 후 충무로 을 따라 348m 이동 ",
                                        "linestring": "126.99304,37.56428 126.99301,37.564255 126.99298,37.56422 126.99307,37.563396 126.99308,37.563362 126.99312,37.56307 126.99315,37.562813 126.99316,37.56274 126.993164,37.56264 126.99317,37.56256 126.993195,37.56232 126.99323,37.562176 126.99332,37.561417 126.99333,37.56135 126.99333,37.561325 126.99349,37.561253"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 30,
                                        "description": "충무로믿음치과의원 에서 횡단보도 후 보행자도로 을 따라 30m 이동 ",
                                        "linestring": "126.99349,37.561253 126.99355,37.56098"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 108,
                                        "description": "충무로역  3번출구 에서 좌회전 후 퇴계로 을 따라 108m 이동 ",
                                        "linestring": "126.99355,37.56098 126.99361,37.560993 126.99365,37.561005 126.99391,37.561058 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 1595,
                        "transferCount": 1,
                        "totalDistance": 14782,
                        "pathType": 1,
                        "totalWalkDistance": 1920
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1500,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 3064,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 642,
                                "distance": 764,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동",
                                    "lon": 127.04774722222223,
                                    "lat": 37.65320555555556
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 52,
                                        "description": "52m 이동",
                                        "linestring": "127.05074,37.653175 127.05066,37.65342 127.05059,37.653625"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 190,
                                        "description": "좌회전 후 190m 이동 ",
                                        "linestring": "127.05059,37.653625 127.05059,37.653633 127.05045,37.653675 127.05042,37.653687 127.04998,37.653572 127.04956,37.653492 127.049446,37.65345 127.04941,37.653435 127.048904,37.65332 127.04888,37.653316 127.04887,37.653347 127.04881,37.65348 127.04869,37.65345"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 191,
                                        "description": "지하보도 진입 후 191m 이동 ",
                                        "linestring": "127.04869,37.65345 127.04771,37.653217 127.04764,37.653202 127.046684,37.65298 127.046616,37.65297"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 158,
                                        "description": "동광교회 에서 우회전 후 158m 이동 ",
                                        "linestring": "127.046616,37.65297 127.04657,37.653053 127.04649,37.653255 127.04634,37.653614 127.04605,37.654324"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 14,
                                        "description": "훼미리마트 창동동아점 에서 우회전 후 14m 이동 ",
                                        "linestring": "127.04605,37.654324 127.046196,37.65436"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 84,
                                        "description": "훼미리마트 창동동아점 에서 우회전 후 84m 이동 ",
                                        "linestring": "127.046196,37.65436 127.04645,37.65379 127.0465,37.653725 127.046585,37.653744"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 75,
                                        "description": "금강한의원 에서 우회전 후 보행자도로 을 따라 75m 이동 ",
                                        "linestring": "127.046585,37.653744 127.046745,37.653305 127.04701,37.65337"
                                    }
                                ]
                            },
                            {
                                "routeColor": "00A5DE",
                                "distance": 12014,
                                "Lane": [
                                    {
                                        "routeColor": "00A5DE",
                                        "route": "수도권4호선(급행)",
                                        "routeId": "111041002",
                                        "service": 0,
                                        "type": 119
                                    }
                                ],
                                "start": {
                                    "name": "창동",
                                    "lon": 127.04774722222223,
                                    "lat": 37.65320555555556
                                },
                                "type": 4,
                                "mode": "SUBWAY",
                                "sectionTime": 1322,
                                "route": "수도권4호선",
                                "routeId": "110041030",
                                "service": 1,
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동",
                                            "lon": "127.047747",
                                            "lat": "37.653206",
                                            "stationID": "110407"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "쌍문",
                                            "lon": "127.034633",
                                            "lat": "37.648514",
                                            "stationID": "110408"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "수유(강북구청)",
                                            "lon": "127.025439",
                                            "lat": "37.637803",
                                            "stationID": "110409"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "미아",
                                            "lon": "127.026125",
                                            "lat": "37.626442",
                                            "stationID": "110410"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "미아사거리",
                                            "lon": "127.030094",
                                            "lat": "37.613239",
                                            "stationID": "110411"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "길음",
                                            "lon": "127.025064",
                                            "lat": "37.603458",
                                            "stationID": "110412"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "성신여대입구",
                                            "lon": "127.016522",
                                            "lat": "37.592706",
                                            "stationID": "110413"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "한성대입구",
                                            "lon": "127.006303",
                                            "lat": "37.588522",
                                            "stationID": "110414"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "혜화",
                                            "lon": "127.001772",
                                            "lat": "37.582689",
                                            "stationID": "110415"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "동대문",
                                            "lon": "127.009161",
                                            "lat": "37.571050",
                                            "stationID": "110416"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "동대문역사문화공원",
                                            "lon": "127.007356",
                                            "lat": "37.564644",
                                            "stationID": "110417"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00735555555555,
                                    "lat": 37.56464444444445
                                },
                                "passShape": {
                                    "linestring": "127.047747,37.653203 127.046533,37.652922 127.046358,37.652881 127.042194,37.651900 127.041894,37.651825 127.041644,37.651772 127.041364,37.651731 127.040589,37.651653 127.036831,37.651383 127.036789,37.651381 127.036747,37.651378 127.036706,37.651369 127.036667,37.651364 127.036625,37.651356 127.036583,37.651344 127.036544,37.651331 127.036506,37.651317 127.036469,37.651303 127.036433,37.651286 127.036397,37.651267 127.036364,37.651250 127.036331,37.651228 127.036297,37.651206 127.036267,37.651181 127.036239,37.651158 127.036211,37.651131 127.036186,37.651106 127.036164,37.651078 127.036142,37.651050 127.036119,37.651019 127.034508,37.648306 127.034314,37.647978 127.032192,37.644414 127.031883,37.643953 127.031753,37.643775 127.031614,37.643603 127.031461,37.643433 127.031011,37.642997 127.027586,37.639806 127.026211,37.638519 127.025683,37.638025 127.025442,37.637800 127.023678,37.636158 127.023639,37.636117 127.023600,37.636075 127.023564,37.636031 127.023531,37.635989 127.023497,37.635942 127.023467,37.635894 127.023439,37.635850 127.023411,37.635803 127.023386,37.635753 127.023364,37.635703 127.023344,37.635656 127.023325,37.635606 127.023308,37.635553 127.023294,37.635503 127.023283,37.635453 127.023272,37.635400 127.023267,37.635350 127.023258,37.635297 127.023256,37.635244 127.023256,37.635192 127.023256,37.635139 127.023467,37.633225 127.023497,37.633078 127.023536,37.632939 127.023597,37.632764 127.024297,37.631053 127.025981,37.626789 127.026267,37.626092 127.026717,37.624994 127.029719,37.617503 127.029731,37.617469 127.029742,37.617433 127.029753,37.617400 127.029764,37.617367 127.029775,37.617333 127.029783,37.617300 127.029794,37.617264 127.029803,37.617231 127.029811,37.617194 127.029819,37.617161 127.029828,37.617125 127.029836,37.617092 127.029842,37.617056 127.029850,37.617022 127.029856,37.616989 127.029861,37.616953 127.029867,37.616917 127.029869,37.616883 127.029875,37.616847 127.029881,37.616814 127.029883,37.616778 127.030089,37.613319 127.030097,37.613239 127.030181,37.612358 127.030303,37.611303 127.030317,37.611122 127.030319,37.610881 127.030314,37.610656 127.030225,37.609453 127.030222,37.609411 127.030217,37.609369 127.030211,37.609328 127.030203,37.609289 127.030194,37.609247 127.030183,37.609206 127.030172,37.609164 127.030158,37.609125 127.030144,37.609083 127.030128,37.609044 127.030111,37.609006 127.030092,37.608967 127.030072,37.608928 127.030050,37.608889 127.030028,37.608853 127.030006,37.608814 127.029981,37.608778 127.029956,37.608742 127.029928,37.608706 127.029900,37.608669 127.029869,37.608636 127.029183,37.607872 127.028731,37.607353 127.028319,37.606925 127.027442,37.606106 127.026981,37.605708 127.025703,37.604708 127.025642,37.604661 127.025625,37.604650 127.025608,37.604633 127.025592,37.604619 127.025578,37.604606 127.025564,37.604592 127.025550,37.604578 127.025533,37.604561 127.025522,37.604544 127.025508,37.604531 127.025497,37.604514 127.025486,37.604497 127.025475,37.604481 127.025464,37.604464 127.025456,37.604444 127.025447,37.604428 127.025439,37.604411 127.025431,37.604392 127.025425,37.604375 127.025417,37.604356 127.025411,37.604339 127.025406,37.604319 127.025347,37.604081 127.025231,37.603789 127.024883,37.603103 127.024483,37.602314 127.024381,37.602161 127.024292,37.602050 127.024061,37.601822 127.023722,37.601558 127.022014,37.600267 127.021942,37.600183 127.021858,37.600025 127.021831,37.599931 127.021728,37.598031 127.021722,37.597917 127.021714,37.597803 127.021700,37.597689 127.021678,37.597575 127.021656,37.597464 127.021625,37.597350 127.021592,37.597242 127.021550,37.597131 127.021506,37.597022 127.021458,37.596914 127.021403,37.596808 127.021344,37.596706 127.021281,37.596603 127.021214,37.596503 127.021142,37.596403 127.021067,37.596308 127.020983,37.596214 127.020900,37.596122 127.020811,37.596031 127.020717,37.595944 127.020622,37.595861 127.017789,37.593419 127.017697,37.593342 127.017417,37.593142 127.017239,37.593039 127.016903,37.592867 127.016617,37.592736 127.016525,37.592703 127.016508,37.592694 127.016272,37.592628 127.015875,37.592558 127.015600,37.592517 127.014814,37.592425 127.014739,37.592414 127.014664,37.592403 127.014589,37.592389 127.014517,37.592375 127.014442,37.592358 127.014369,37.592342 127.014297,37.592325 127.014225,37.592306 127.014153,37.592286 127.014081,37.592264 127.014011,37.592242 127.013942,37.592219 127.013872,37.592194 127.013803,37.592167 127.013736,37.592142 127.013669,37.592114 127.013603,37.592083 127.013539,37.592053 127.013472,37.592019 127.013408,37.591989 127.013344,37.591956 127.011475,37.590908 127.011100,37.590708 127.010586,37.590453 127.010136,37.590236 127.006822,37.588744 127.006478,37.588592 127.006003,37.588400 127.005931,37.588375 127.004636,37.587928 127.003289,37.587450 127.003128,37.587381 127.002972,37.587303 127.002822,37.587219 127.002678,37.587131 127.002539,37.587033 127.002408,37.586931 127.002283,37.586825 127.002167,37.586711 127.002058,37.586592 127.001958,37.586469 127.001869,37.586342 127.001786,37.586214 127.001714,37.586078 127.001650,37.585942 127.001594,37.585803 127.001550,37.585661 127.001514,37.585517 127.001489,37.585372 127.001475,37.585228 127.001469,37.585081 127.001475,37.584933 127.001592,37.584000 127.001806,37.582694 127.002050,37.581203 127.002094,37.580794 127.002125,37.580439 127.002144,37.580078 127.002197,37.578119 127.002233,37.577917 127.002275,37.577722 127.002325,37.577514 127.002392,37.577278 127.002442,37.577103 127.002517,37.576922 127.002611,37.576736 127.002719,37.576569 127.002864,37.576425 127.003017,37.576331 127.003206,37.576258 127.003417,37.576181 127.003600,37.576133 127.003806,37.576075 127.003914,37.576044 127.004014,37.576011 127.004089,37.575994 127.004158,37.575975 127.004233,37.575956 127.004306,37.575936 127.004375,37.575917 127.004458,37.575883 127.004542,37.575847 127.004622,37.575808 127.004703,37.575769 127.004778,37.575725 127.004853,37.575681 127.004928,37.575636 127.005000,37.575586 127.005067,37.575536 127.005133,37.575483 127.005200,37.575431 127.005261,37.575375 127.005319,37.575317 127.005378,37.575258 127.005433,37.575197 127.005483,37.575136 127.008889,37.571453 127.008992,37.571308 127.009114,37.571139 127.009258,37.570911 127.009486,37.570547 127.009617,37.570203 127.009742,37.569244 127.009811,37.568661 127.009814,37.568617 127.009817,37.568575 127.009819,37.568528 127.009819,37.568483 127.009817,37.568442 127.009814,37.568397 127.009808,37.568353 127.009803,37.568308 127.009794,37.568264 127.009783,37.568219 127.009775,37.568178 127.009761,37.568133 127.009747,37.568092 127.009733,37.568050 127.009717,37.568006 127.009697,37.567964 127.009450,37.567483 127.009281,37.567164 127.009106,37.566825 127.008933,37.566497 127.008781,37.566247 127.008606,37.566017 127.008444,37.565839 127.007356,37.564644"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 185,
                                "distance": 238,
                                "start": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00735555555555,
                                    "lat": 37.56464444444445
                                },
                                "end": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00550833333334,
                                    "lat": 37.564675
                                },
                                "passShape": {
                                    "linestring": "127.007356,37.564644 127.007442,37.564703 127.007164,37.564858 127.007211,37.564989 127.007206,37.565003 127.007092,37.564700 127.006939,37.564600 127.006889,37.564578 127.006844,37.564558 127.006806,37.564553 127.006731,37.564553 127.006656,37.564553 127.006275,37.564608 127.006167,37.564628 127.006094,37.564639 127.005781,37.564689 127.005664,37.564708 127.005508,37.564675"
                                }
                            },
                            {
                                "mode": "SUBWAY",
                                "routeColor": "996CAC",
                                "sectionTime": 120,
                                "route": "수도권5호선",
                                "routeId": "110051006",
                                "distance": 722,
                                "service": 1,
                                "start": {
                                    "name": "동대문역사문화공원",
                                    "lon": 127.00550833333334,
                                    "lat": 37.564675
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "동대문역사문화공원",
                                            "lon": "127.005508",
                                            "lat": "37.564675",
                                            "stationID": "110527"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "을지로4가",
                                            "lon": "126.998075",
                                            "lat": "37.567369",
                                            "stationID": "110526"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "을지로4가",
                                    "lon": 126.998075,
                                    "lat": 37.567369444444445
                                },
                                "type": 5,
                                "passShape": {
                                    "linestring": "127.005508,37.564675 127.005044,37.564733 127.004317,37.564756 127.003350,37.564683 127.001658,37.564586 127.000783,37.564528 127.000725,37.564525 127.000650,37.564531 127.000558,37.564542 127.000483,37.564553 127.000419,37.564567 127.000275,37.564611 127.000133,37.564661 126.999994,37.564714 126.999856,37.564772 126.999722,37.564836 126.999594,37.564903 126.999467,37.564975 126.999344,37.565053 126.999228,37.565131 126.999114,37.565217 126.999006,37.565306 126.998903,37.565394 126.998803,37.565492 126.998708,37.565589 126.998622,37.565692 126.998539,37.565797 126.998464,37.565903 126.998392,37.566014 126.998328,37.566125 126.998267,37.566242 126.998217,37.566356 126.998181,37.566472 126.998153,37.566642 126.998108,37.566919 126.998067,37.567369"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 795,
                                "distance": 940,
                                "start": {
                                    "name": "을지로4가",
                                    "lon": 126.998075,
                                    "lat": 37.567369444444445
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 81,
                                        "description": "81m 이동",
                                        "linestring": "126.998055,37.567368 126.998055,37.567326 126.998116,37.566643"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 2,
                                        "description": "을지로4가역 에서 우회전 후 2m 이동 ",
                                        "linestring": "126.998116,37.566643 126.9981,37.566643"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 30,
                                        "description": "을지로4가역 에서 좌회전 후 30m 이동 ",
                                        "linestring": "126.9981,37.566643 126.9979,37.566425"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 22,
                                        "description": "좌회전 후 22m 이동 ",
                                        "linestring": "126.9979,37.566425 126.99798,37.566376 126.997986,37.566273 126.998,37.56626"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 27,
                                        "description": "을지로4가역  9번출구 에서 우회전 후 보행자도로 을 따라 27m 이동 ",
                                        "linestring": "126.998,37.56626 126.998024,37.566017"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 23,
                                        "description": "건축사사무소엠앤케이 에서 횡단보도 후 보행자도로 을 따라 23m 이동 ",
                                        "linestring": "126.998085,37.564423 126.998116,37.56421"
                                    },
                                    {
                                        "streetName": "창경궁로",
                                        "distance": 194,
                                        "description": "우리은행 중구청출장소 에서 좌회전 후 창경궁로 을 따라 194m 이동 ",
                                        "linestring": "126.998116,37.56421 126.99816,37.564175 126.99819,37.564144 126.99821,37.56413 126.99821,37.56413 126.99823,37.563793 126.99826,37.563404 126.99827,37.563274 126.99828,37.563087 126.9983,37.562954 126.998314,37.56286 126.99834,37.5625"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 30,
                                        "description": "횡단보도 후 보행자도로 을 따라 30m 이동 ",
                                        "linestring": "126.99821,37.56232 126.99826,37.56205"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 200,
                                        "description": "옛날5가홍탁집 에서 우회전 후 퇴계로 을 따라 200m 이동 ",
                                        "linestring": "126.99826,37.56205 126.99788,37.561966 126.997604,37.561905 126.9974,37.56186 126.99737,37.56184 126.99734,37.56183 126.99671,37.5617 126.99657,37.56167 126.99634,37.561604 126.99614,37.561546 126.9961,37.561535"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 18,
                                        "description": "횡단보도 후 보행자도로 을 따라 18m 이동 ",
                                        "linestring": "126.9961,37.561535 126.9959,37.561493"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 108,
                                        "description": "직진 후 퇴계로 을 따라 108m 이동 ",
                                        "linestring": "126.9959,37.561493 126.99578,37.56146 126.99559,37.56142 126.99555,37.561413 126.995125,37.56132 126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 1622,
                        "transferCount": 1,
                        "totalDistance": 13983,
                        "pathType": 1,
                        "totalWalkDistance": 1942
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1500,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 4667,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 1137,
                                "distance": 1395,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "도봉구민회관.도봉문화원",
                                    "lon": 127.0380611111111,
                                    "lat": 37.654513888888886
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 52,
                                        "description": "52m 이동",
                                        "linestring": "127.05074,37.653175 127.05066,37.65342 127.05059,37.653625"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 190,
                                        "description": "좌회전 후 190m 이동 ",
                                        "linestring": "127.05059,37.653625 127.05059,37.653633 127.05045,37.653675 127.05042,37.653687 127.04998,37.653572 127.04956,37.653492 127.049446,37.65345 127.04941,37.653435 127.048904,37.65332 127.04888,37.653316 127.04887,37.653347 127.04881,37.65348 127.04869,37.65345"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 191,
                                        "description": "지하보도 진입 후 191m 이동 ",
                                        "linestring": "127.04869,37.65345 127.04771,37.653217 127.04764,37.653202 127.046684,37.65298 127.046616,37.65297"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 10,
                                        "description": "동광교회 에서 우회전 후 10m 이동 ",
                                        "linestring": "127.046616,37.65297 127.04657,37.653053"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 230,
                                        "description": "창동역  2번출구 에서 좌회전 후 230m 이동 ",
                                        "linestring": "127.04657,37.653053 127.04654,37.65304 127.04622,37.65297 127.04593,37.652897 127.04583,37.652878 127.045784,37.652866 127.04577,37.652863 127.0456,37.652817 127.04543,37.65277 127.045105,37.652695 127.04497,37.652664 127.04408,37.652462"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 286,
                                        "description": "우회전 후 286m 이동 ",
                                        "linestring": "127.04408,37.652462 127.04407,37.65246 127.04397,37.652515 127.04396,37.65252 127.043945,37.652573 127.04394,37.652603 127.043915,37.65264 127.04387,37.652756 127.04383,37.652798 127.04371,37.65289 127.04361,37.65295 127.04343,37.65299 127.043274,37.653034 127.04325,37.65304 127.043236,37.65305 127.0431,37.65312 127.04298,37.653175 127.04284,37.65324 127.04266,37.653316 127.04257,37.653343 127.04247,37.65335 127.04227,37.653366 127.04209,37.65338 127.04203,37.653397 127.041985,37.653416 127.04189,37.653446 127.041756,37.653507 127.04164,37.65354 127.04159,37.653553 127.04144,37.65358 127.04136,37.65359"
                                    },
                                    {
                                        "streetName": "해등로",
                                        "distance": 70,
                                        "description": "해남공판장 에서 우회전 후 해등로 을 따라 70m 이동 ",
                                        "linestring": "127.04136,37.65359 127.04121,37.653664 127.04111,37.65371 127.041084,37.65389 127.04105,37.653996 127.04104,37.654053 127.04102,37.654106"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 20,
                                        "description": "교촌치킨 에서 좌측 횡단보도 후 보행자도로 을 따라 20m 이동 ",
                                        "linestring": "127.04102,37.654106 127.04081,37.654076"
                                    },
                                    {
                                        "streetName": "해등로",
                                        "distance": 12,
                                        "description": "참조은농산물마트 에서 직진 후 해등로 을 따라 12m 이동 ",
                                        "linestring": "127.04081,37.654076 127.04082,37.654034 127.040825,37.653965"
                                    },
                                    {
                                        "streetName": "도봉로",
                                        "distance": 73,
                                        "description": "오일뱅크 창동 에서 좌회전 후 도봉로 을 따라 73m 이동 ",
                                        "linestring": "127.03862,37.654808 127.03854,37.654686 127.03825,37.654217"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 22,
                                        "description": "도봉구민회관 에서 우측 횡단보도 후 보행자도로 을 따라 22m 이동 ",
                                        "linestring": "127.03825,37.654217 127.038124,37.654266 127.038025,37.654305"
                                    },
                                    {
                                        "streetName": "도봉로",
                                        "distance": 22,
                                        "description": "우회전 후 도봉로 을 따라 22m 이동 ",
                                        "linestring": "127.038025,37.654305 127.03813,37.654484"
                                    }
                                ]
                            },
                            {
                                "routeColor": "0068B7",
                                "distance": 12018,
                                "Lane": [
                                    {
                                        "routeColor": "0068B7",
                                        "route": "간선:N16",
                                        "routeId": "11468001",
                                        "service": 0,
                                        "type": 11
                                    }
                                ],
                                "start": {
                                    "name": "도봉구민회관.도봉문화원",
                                    "lon": 127.0380611111111,
                                    "lat": 37.654513888888886
                                },
                                "type": 11,
                                "mode": "BUS",
                                "sectionTime": 3356,
                                "route": "간선:140",
                                "routeId": "11430001",
                                "service": 1,
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "도봉구민회관.도봉문화원",
                                            "lon": "127.038061",
                                            "lat": "37.654514",
                                            "stationID": "778603"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "쌍문역",
                                            "lon": "127.034636",
                                            "lat": "37.648761",
                                            "stationID": "778341"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "우이1교앞",
                                            "lon": "127.032492",
                                            "lat": "37.645150",
                                            "stationID": "778196"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "수유3동우체국",
                                            "lon": "127.028950",
                                            "lat": "37.641236",
                                            "stationID": "778044"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "수유(강북구청)역",
                                            "lon": "127.025917",
                                            "lat": "37.638425",
                                            "stationID": "777948"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "수유역",
                                            "lon": "127.023803",
                                            "lat": "37.636456",
                                            "stationID": "777872"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "수유시장.성신여대미아캠퍼스앞",
                                            "lon": "127.024094",
                                            "lat": "37.631186",
                                            "stationID": "777651"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "미아역.신일중고",
                                            "lon": "127.026572",
                                            "lat": "37.624967",
                                            "stationID": "777371"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "도봉세무서.성북시장",
                                            "lon": "127.028672",
                                            "lat": "37.619669",
                                            "stationID": "777197"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "미아사거리역",
                                            "lon": "127.029889",
                                            "lat": "37.613983",
                                            "stationID": "776905"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "길음2동주민센터",
                                            "lon": "127.028131",
                                            "lat": "37.606906",
                                            "stationID": "776571"
                                        },
                                        {
                                            "index": 11,
                                            "stationName": "길음뉴타운",
                                            "lon": "127.024219",
                                            "lat": "37.603722",
                                            "stationID": "776424"
                                        },
                                        {
                                            "index": 12,
                                            "stationName": "미아리고개.미아리예술극장",
                                            "lon": "127.021672",
                                            "lat": "37.598806",
                                            "stationID": "776162"
                                        },
                                        {
                                            "index": 13,
                                            "stationName": "돈암사거리.성신여대입구",
                                            "lon": "127.018219",
                                            "lat": "37.593944",
                                            "stationID": "775942"
                                        },
                                        {
                                            "index": 14,
                                            "stationName": "삼선교.한성대학교",
                                            "lon": "127.009192",
                                            "lat": "37.589928",
                                            "stationID": "775768"
                                        },
                                        {
                                            "index": 15,
                                            "stationName": "혜화동로터리.여운형활동터",
                                            "lon": "127.001658",
                                            "lat": "37.586281",
                                            "stationID": "775592"
                                        },
                                        {
                                            "index": 16,
                                            "stationName": "명륜3가.성대입구",
                                            "lon": "126.998453",
                                            "lat": "37.582908",
                                            "stationID": "758772"
                                        },
                                        {
                                            "index": 17,
                                            "stationName": "창경궁.서울대학교병원",
                                            "lon": "126.996506",
                                            "lat": "37.579175",
                                            "stationID": "758602"
                                        },
                                        {
                                            "index": 18,
                                            "stationName": "원남동",
                                            "lon": "126.997356",
                                            "lat": "37.574428",
                                            "stationID": "758413"
                                        },
                                        {
                                            "index": 19,
                                            "stationName": "광장시장",
                                            "lon": "126.997761",
                                            "lat": "37.569375",
                                            "stationID": "758160"
                                        },
                                        {
                                            "index": 20,
                                            "stationName": "중구청앞.덕수중학교",
                                            "lon": "126.998169",
                                            "lat": "37.564786",
                                            "stationID": "757946"
                                        },
                                        {
                                            "index": 21,
                                            "stationName": "충무로역8번출구.대한극장앞",
                                            "lon": "126.996542",
                                            "lat": "37.561922",
                                            "stationID": "757806"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "충무로역8번출구.대한극장앞",
                                    "lon": 126.99654166666667,
                                    "lat": 37.56192222222222
                                },
                                "passShape": {
                                    "linestring": "127.038092,37.654486 127.036275,37.651433 127.036183,37.651283 127.034672,37.648739 127.033375,37.646553 127.032536,37.645142 127.031942,37.644139 127.031575,37.643658 127.031153,37.643208 127.031039,37.643117 127.028992,37.641225 127.027381,37.639733 127.027264,37.639625 127.025958,37.638411 127.023856,37.636456 127.023847,37.636447 127.023564,37.636175 127.023394,37.635961 127.023297,37.635803 127.023189,37.635550 127.023156,37.635389 127.023142,37.635278 127.023181,37.634889 127.023194,37.634747 127.023208,37.634606 127.023331,37.633383 127.023428,37.632983 127.024139,37.631181 127.025792,37.627000 127.026106,37.626242 127.026617,37.624964 127.027939,37.621650 127.028717,37.619678 127.029433,37.617861 127.029675,37.617214 127.029708,37.617069 127.029764,37.616783 127.029781,37.616036 127.029933,37.613975 127.030019,37.612792 127.030094,37.612286 127.030233,37.611583 127.030267,37.611283 127.030258,37.610969 127.030142,37.609672 127.029925,37.609075 127.029731,37.608633 127.028658,37.607378 127.028161,37.606878 127.028125,37.606842 127.026917,37.605811 127.025181,37.604389 127.024892,37.604153 127.024264,37.603711 127.024100,37.603594 127.022919,37.602967 127.022689,37.602822 127.022350,37.602556 127.022250,37.602394 127.022164,37.602147 127.022150,37.602086 127.021928,37.601194 127.021833,37.600697 127.021717,37.598811 127.021714,37.598781 127.021628,37.597881 127.021525,37.597400 127.021456,37.597183 127.021317,37.596814 127.021150,37.596519 127.020936,37.596269 127.020692,37.596044 127.018256,37.593925 127.017694,37.593433 127.017467,37.593264 127.017203,37.593097 127.016975,37.592972 127.016561,37.592792 127.016389,37.592725 127.015978,37.592600 127.015564,37.592533 127.014739,37.592444 127.014564,37.592417 127.014300,37.592347 127.014081,37.592281 127.013886,37.592206 127.013244,37.591908 127.013089,37.591836 127.010875,37.590675 127.009381,37.589975 127.009228,37.589908 127.006175,37.588575 127.006008,37.588508 127.004692,37.588008 127.003494,37.587592 127.002994,37.587367 127.002525,37.587075 127.002189,37.586803 127.001989,37.586614 127.001703,37.586275 127.001417,37.585936 127.001361,37.585844 127.000947,37.585369 127.000853,37.585283 127.000361,37.584714 127.000000,37.584336 126.999506,37.583819 126.998981,37.583331 126.998744,37.583119 126.998500,37.582900 126.997808,37.582289 126.996719,37.581367 126.996581,37.581233 126.996489,37.581108 126.996417,37.580933 126.996358,37.580631 126.996367,37.580456 126.996550,37.579186 126.996642,37.578553 126.997019,37.577325 126.997128,37.576919 126.997150,37.576692 126.997244,37.576006 126.997264,37.575853 126.997356,37.575003 126.997400,37.574425 126.997653,37.571167 126.997675,37.570808 126.997683,37.570664 126.997800,37.569394 126.997831,37.569025 126.997858,37.568697 126.997992,37.567111 126.998022,37.566736 126.998036,37.566592 126.998211,37.564803 126.998453,37.562331 126.996572,37.561894"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 174,
                                "distance": 204,
                                "start": {
                                    "name": "충무로역8번출구.대한극장앞",
                                    "lon": 126.99654166666667,
                                    "lat": 37.56192222222222
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 77,
                                        "description": "퇴계로 을 따라 77m 이동",
                                        "linestring": "126.99654,37.56194 126.99625,37.56187 126.9962,37.56186 126.99605,37.56182 126.995834,37.561768 126.9957,37.56173"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 31,
                                        "description": "서울이비인후과의원 에서 좌측 횡단보도 후 보행자도로 을 따라 31m 이동 ",
                                        "linestring": "126.9957,37.56173 126.99578,37.56146"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 96,
                                        "description": "충무로역  1번출구 에서 우회전 후 퇴계로 을 따라 96m 이동 ",
                                        "linestring": "126.99578,37.56146 126.99559,37.56142 126.99555,37.561413 126.995125,37.56132 126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 1311,
                        "transferCount": 0,
                        "totalDistance": 13324,
                        "pathType": 2,
                        "totalWalkDistance": 1599
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1600,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 4462,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 370,
                                "distance": 439,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동교",
                                    "lon": 127.05324722222223,
                                    "lat": 37.651475
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 70,
                                        "description": "70m 이동",
                                        "linestring": "127.05074,37.653175 127.05075,37.653145 127.05085,37.65288 127.05087,37.652847 127.050896,37.652817 127.050964,37.65261 127.050934,37.65258"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 27,
                                        "description": "KB국민은행 창동지점 에서 좌측 횡단보도 후 보행자도로 을 따라 27m 이동 ",
                                        "linestring": "127.050934,37.65258 127.05122,37.652653"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 12,
                                        "description": "제일빌딩 에서 우회전 후 노해로 을 따라 12m 이동 ",
                                        "linestring": "127.05122,37.652653 127.05134,37.6526"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 35,
                                        "description": "제일빌딩 에서 횡단보도 후 보행자도로 을 따라 35m 이동 ",
                                        "linestring": "127.05134,37.6526 127.05146,37.652298"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 153,
                                        "description": "창4동주민센터 에서 좌회전 후 153m 이동 ",
                                        "linestring": "127.05146,37.652298 127.05237,37.65252 127.05304,37.652676 127.05312,37.65269"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 6,
                                        "description": "우회전 후 노해로 을 따라 6m 이동 ",
                                        "linestring": "127.05312,37.65269 127.05315,37.652695 127.05318,37.652676"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 136,
                                        "description": "보행자도로, 136m",
                                        "linestring": "127.05318,37.652676 127.05323,37.652645 127.05323,37.65259 127.05324,37.652313 127.05326,37.6518 127.05327,37.651474"
                                    }
                                ]
                            },
                            {
                                "mode": "BUS",
                                "routeColor": "0068B7",
                                "sectionTime": 521,
                                "route": "간선:147",
                                "routeId": "11502001",
                                "distance": 2313,
                                "service": 1,
                                "start": {
                                    "name": "창동교",
                                    "lon": 127.05324722222223,
                                    "lat": 37.651475
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동교",
                                            "lon": "127.053247",
                                            "lat": "37.651475",
                                            "stationID": "800569"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "녹천교",
                                            "lon": "127.054531",
                                            "lat": "37.644558",
                                            "stationID": "800570"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "월계보건지소",
                                            "lon": "127.061411",
                                            "lat": "37.631833",
                                            "stationID": "777672"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "월계보건지소",
                                    "lon": 127.06141111111111,
                                    "lat": 37.63183333333333
                                },
                                "type": 11,
                                "passShape": {
                                    "linestring": "127.053289,37.651461 127.053306,37.650864 127.053358,37.650372 127.053461,37.649942 127.054269,37.648050 127.054522,37.647339 127.054669,37.646631 127.054700,37.646364 127.054717,37.645742 127.054686,37.645483 127.054694,37.645119 127.054672,37.644958 127.054575,37.644564 127.054422,37.643942 127.054092,37.642794 127.053997,37.642542 127.053908,37.641986 127.053917,37.641444 127.053964,37.641167 127.054050,37.640972 127.054289,37.640550 127.054656,37.639983 127.054786,37.639825 127.056775,37.638228 127.057042,37.638006 127.057303,37.637758 127.057617,37.637406 127.057900,37.637039 127.058692,37.635708 127.059044,37.635064 127.059747,37.634514 127.061917,37.632572 127.061978,37.632450 127.062000,37.632333 127.061961,37.632131 127.061453,37.631819"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 0,
                                "distance": 0,
                                "start": {
                                    "name": "월계보건지소",
                                    "lon": 127.06141111111111,
                                    "lat": 37.63183333333333
                                },
                                "end": {
                                    "name": "월계보건지소",
                                    "lon": 127.06141111111111,
                                    "lat": 37.63183333333333
                                },
                                "passShape": {
                                    "linestring": "127.061411,37.631833 127.061411,37.631833"
                                }
                            },
                            {
                                "mode": "BUS",
                                "routeColor": "0068B7",
                                "sectionTime": 2862,
                                "route": "간선:100",
                                "routeId": "11421001",
                                "distance": 9813,
                                "service": 1,
                                "start": {
                                    "name": "월계보건지소",
                                    "lon": 127.06141111111111,
                                    "lat": 37.63183333333333
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "월계보건지소",
                                            "lon": "127.061411",
                                            "lat": "37.631833",
                                            "stationID": "777672"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "인덕대학",
                                            "lon": "127.055236",
                                            "lat": "37.627931",
                                            "stationID": "777520"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "월계주공108동앞롯데캐슬루나아파트",
                                            "lon": "127.052600",
                                            "lat": "37.626267",
                                            "stationID": "777443"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "오현초등학교",
                                            "lon": "127.048067",
                                            "lat": "37.623425",
                                            "stationID": "777320"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "꿈의숲주차장입구",
                                            "lon": "127.045369",
                                            "lat": "37.620942",
                                            "stationID": "777245"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "북서울꿈의숲",
                                            "lon": "127.044133",
                                            "lat": "37.619039",
                                            "stationID": "777161"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "송중동한일유엔아이",
                                            "lon": "127.038019",
                                            "lat": "37.613856",
                                            "stationID": "776892"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "창문여고앞",
                                            "lon": "127.035544",
                                            "lat": "37.611947",
                                            "stationID": "776799"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "숭곡초등학교입구",
                                            "lon": "127.031844",
                                            "lat": "37.610006",
                                            "stationID": "776696"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "길음2동주민센터",
                                            "lon": "127.028131",
                                            "lat": "37.606906",
                                            "stationID": "776571"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "길음뉴타운",
                                            "lon": "127.024219",
                                            "lat": "37.603722",
                                            "stationID": "776424"
                                        },
                                        {
                                            "index": 11,
                                            "stationName": "미아리고개.미아리예술극장",
                                            "lon": "127.021672",
                                            "lat": "37.598806",
                                            "stationID": "776162"
                                        },
                                        {
                                            "index": 12,
                                            "stationName": "돈암사거리.성신여대입구",
                                            "lon": "127.018219",
                                            "lat": "37.593944",
                                            "stationID": "775942"
                                        },
                                        {
                                            "index": 13,
                                            "stationName": "삼선교.한성대학교",
                                            "lon": "127.009192",
                                            "lat": "37.589928",
                                            "stationID": "775768"
                                        },
                                        {
                                            "index": 14,
                                            "stationName": "혜화동로터리.여운형활동터",
                                            "lon": "127.001658",
                                            "lat": "37.586281",
                                            "stationID": "775592"
                                        },
                                        {
                                            "index": 15,
                                            "stationName": "명륜3가.성대입구",
                                            "lon": "126.998453",
                                            "lat": "37.582908",
                                            "stationID": "758772"
                                        },
                                        {
                                            "index": 16,
                                            "stationName": "창경궁.서울대학교병원",
                                            "lon": "126.996506",
                                            "lat": "37.579175",
                                            "stationID": "758602"
                                        },
                                        {
                                            "index": 17,
                                            "stationName": "원남동",
                                            "lon": "126.997356",
                                            "lat": "37.574428",
                                            "stationID": "758413"
                                        },
                                        {
                                            "index": 18,
                                            "stationName": "광장시장",
                                            "lon": "126.997761",
                                            "lat": "37.569375",
                                            "stationID": "758160"
                                        },
                                        {
                                            "index": 19,
                                            "stationName": "을지로4가",
                                            "lon": "126.995967",
                                            "lat": "37.566664",
                                            "stationID": "758029"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "을지로4가",
                                    "lon": 126.99596666666666,
                                    "lat": 37.56666388888889
                                },
                                "type": 11,
                                "passShape": {
                                    "linestring": "127.061453,37.631819 127.061081,37.631594 127.060939,37.631506 127.060492,37.631183 127.058792,37.630108 127.057869,37.629497 127.057625,37.629400 127.056467,37.628667 127.055817,37.628253 127.055675,37.628164 127.055303,37.627931 127.055278,37.627917 127.054639,37.627514 127.053978,37.627094 127.052653,37.626253 127.052625,37.626233 127.052000,37.625836 127.051858,37.625747 127.051686,37.625639 127.050714,37.625017 127.049969,37.624483 127.049631,37.624281 127.049481,37.624200 127.048106,37.623408 127.047067,37.622811 127.046608,37.622494 127.046397,37.622303 127.046292,37.622214 127.045914,37.621794 127.045803,37.621644 127.045578,37.621242 127.045403,37.620914 127.044808,37.619811 127.044686,37.619614 127.044158,37.619008 127.044106,37.618950 127.043758,37.618628 127.043078,37.618128 127.040431,37.616242 127.040142,37.616011 127.039731,37.615611 127.038064,37.613844 127.037922,37.613694 127.037811,37.613567 127.037581,37.613256 127.037253,37.612861 127.037175,37.612786 127.037042,37.612694 127.035544,37.611911 127.035144,37.611700 127.034992,37.611619 127.033478,37.610817 127.033350,37.610758 127.031883,37.609989 127.030789,37.609414 127.030414,37.609217 127.030258,37.609128 127.030144,37.609050 127.029986,37.608906 127.029731,37.608633 127.028658,37.607378 127.028161,37.606878 127.028125,37.606842 127.026917,37.605811 127.025181,37.604389 127.024892,37.604153 127.024264,37.603711 127.024100,37.603594 127.022919,37.602967 127.022689,37.602822 127.022350,37.602556 127.022250,37.602394 127.022164,37.602147 127.022150,37.602086 127.021928,37.601194 127.021833,37.600697 127.021717,37.598811 127.021714,37.598781 127.021628,37.597881 127.021525,37.597400 127.021456,37.597183 127.021317,37.596814 127.021150,37.596519 127.020936,37.596269 127.020692,37.596044 127.018256,37.593925 127.017694,37.593433 127.017467,37.593264 127.017203,37.593097 127.016975,37.592972 127.016561,37.592792 127.016389,37.592725 127.015978,37.592600 127.015564,37.592533 127.014739,37.592444 127.014564,37.592417 127.014300,37.592347 127.014081,37.592281 127.013886,37.592206 127.013244,37.591908 127.013089,37.591836 127.010875,37.590675 127.009381,37.589975 127.009228,37.589908 127.006175,37.588575 127.006008,37.588508 127.004692,37.588008 127.003494,37.587592 127.002994,37.587367 127.002525,37.587075 127.002189,37.586803 127.001989,37.586614 127.001703,37.586275 127.001417,37.585936 127.001361,37.585844 127.000947,37.585369 127.000853,37.585283 127.000361,37.584714 127.000000,37.584336 126.999506,37.583819 126.998981,37.583331 126.998744,37.583119 126.998500,37.582900 126.997808,37.582289 126.996719,37.581367 126.996581,37.581233 126.996489,37.581108 126.996417,37.580933 126.996358,37.580631 126.996367,37.580456 126.996550,37.579186 126.996642,37.578553 126.997019,37.577325 126.997128,37.576919 126.997150,37.576692 126.997244,37.576006 126.997264,37.575853 126.997356,37.575003 126.997400,37.574425 126.997653,37.571167 126.997675,37.570808 126.997683,37.570664 126.997800,37.569394 126.997831,37.569025 126.997858,37.568697 126.997992,37.567111 126.997575,37.566750 126.997514,37.566708 126.995964,37.566628"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 709,
                                "distance": 853,
                                "start": {
                                    "name": "을지로4가",
                                    "lon": 126.99596666666666,
                                    "lat": 37.56666388888889
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "을지로",
                                        "distance": 40,
                                        "description": "을지로 을 따라 40m 이동",
                                        "linestring": "126.995964,37.56666 126.99573,37.56665 126.99561,37.566643 126.99551,37.566643"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 29,
                                        "description": "제이미디어 에서 좌측 횡단보도 후 보행자도로 을 따라 29m 이동 ",
                                        "linestring": "126.99551,37.566643 126.99552,37.566387"
                                    },
                                    {
                                        "streetName": "을지로",
                                        "distance": 79,
                                        "description": "참조은약국 에서 좌회전 후 을지로 을 따라 79m 이동 ",
                                        "linestring": "126.99552,37.566387 126.995674,37.566395 126.99575,37.5664 126.99586,37.566406 126.996086,37.566418 126.9964,37.56643 126.99642,37.566433"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 247,
                                        "description": "NH농협은행 을지센트럴지점 에서 2시 방향 우회전 후 247m 이동 ",
                                        "linestring": "126.99642,37.566433 126.99646,37.566387 126.99648,37.566154 126.99653,37.56574 126.99653,37.565712 126.99654,37.56559 126.996544,37.56551 126.996544,37.565453 126.99654,37.565426 126.99653,37.565395 126.99647,37.565292 126.99622,37.56499 126.99614,37.564884 126.99611,37.564842 126.996086,37.564796 126.99608,37.56474 126.9961,37.564342 126.99609,37.564323"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 16,
                                        "description": "예진문화기획사 에서 횡단보도 후 보행자도로 을 따라 16m 이동 ",
                                        "linestring": "126.99609,37.564323 126.9961,37.56418"
                                    },
                                    {
                                        "streetName": "마른내로",
                                        "distance": 10,
                                        "description": "황평집 에서 우회전 후 마른내로 을 따라 10m 이동 ",
                                        "linestring": "126.9961,37.56418 126.996056,37.56418 126.99598,37.564175"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 258,
                                        "description": "황평집 에서 좌회전 후 보행자도로 을 따라 258m 이동 ",
                                        "linestring": "126.99598,37.564175 126.995995,37.56406 126.996025,37.563606 126.99604,37.563484 126.996124,37.562576 126.99614,37.56239 126.9962,37.56186"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 47,
                                        "description": "우회전 후 퇴계로 을 따라 47m 이동 ",
                                        "linestring": "126.9962,37.56186 126.99605,37.56182 126.995834,37.561768 126.9957,37.56173"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 31,
                                        "description": "서울이비인후과의원 에서 좌측 횡단보도 후 보행자도로 을 따라 31m 이동 ",
                                        "linestring": "126.9957,37.56173 126.99578,37.56146"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 96,
                                        "description": "충무로역  1번출구 에서 우회전 후 퇴계로 을 따라 96m 이동 ",
                                        "linestring": "126.99578,37.56146 126.99559,37.56142 126.99555,37.561413 126.995125,37.56132 126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 1079,
                        "transferCount": 1,
                        "totalDistance": 13031,
                        "pathType": 2,
                        "totalWalkDistance": 1292
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1500,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 4130,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 927,
                                "distance": 1017,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "노원",
                                    "lon": 127.06053055555556,
                                    "lat": 37.65468055555556
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 70,
                                        "description": "70m 이동",
                                        "linestring": "127.05074,37.653175 127.05075,37.653145 127.05085,37.65288 127.05087,37.652847 127.050896,37.652817 127.050964,37.65261 127.050934,37.65258"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 27,
                                        "description": "KB국민은행 창동지점 에서 좌측 횡단보도 후 보행자도로 을 따라 27m 이동 ",
                                        "linestring": "127.050934,37.65258 127.05122,37.652653"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 104,
                                        "description": "제일빌딩 에서 직진 후 노해로 을 따라 104m 이동 ",
                                        "linestring": "127.05122,37.652653 127.05134,37.6526 127.05231,37.652832 127.0523,37.652855"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 9,
                                        "description": "하이마트 창동점 에서 우측 횡단보도 후 보행자도로 을 따라 9m 이동 ",
                                        "linestring": "127.0523,37.652855 127.0524,37.652878"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 79,
                                        "description": "우회전 후 노해로 을 따라 79m 이동 ",
                                        "linestring": "127.0524,37.652878 127.05241,37.65286 127.05285,37.65296 127.05302,37.653 127.05312,37.653023 127.05319,37.6531"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 32,
                                        "description": "횡단보도 후 보행자도로 을 따라 32m 이동 ",
                                        "linestring": "127.05319,37.6531 127.05356,37.653103"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 117,
                                        "description": "직진 후 노해로 을 따라 117m 이동 ",
                                        "linestring": "127.05356,37.653103 127.0536,37.653107 127.05482,37.653217 127.05485,37.653255"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 35,
                                        "description": "우측 횡단보도 후 35m 이동 ",
                                        "linestring": "127.05485,37.653255 127.05524,37.65329"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 14,
                                        "description": "직진 후 14m 이동 ",
                                        "linestring": "127.05524,37.65329 127.05536,37.6533 127.05539,37.653324"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 8,
                                        "description": "횡단보도 후 보행자도로 을 따라 8m 이동 ",
                                        "linestring": "127.05539,37.653324 127.05546,37.653366"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 185,
                                        "description": "2시 방향 우회전 후 노해로 을 따라 185m 이동 ",
                                        "linestring": "127.05546,37.653366 127.05556,37.653316 127.05584,37.653378 127.05627,37.653473 127.05671,37.65359 127.05727,37.6537 127.05735,37.653717 127.05738,37.653755 127.0574,37.653793"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 20,
                                        "description": "횡단보도 후 보행자도로 을 따라 20m 이동 ",
                                        "linestring": "127.0574,37.653793 127.05762,37.653847"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 249,
                                        "description": "태웅빌딩 에서 직진 후 노해로 을 따라 249m 이동 ",
                                        "linestring": "127.05762,37.653847 127.05772,37.6538 127.058426,37.65398 127.05935,37.654182 127.059616,37.65424 127.05999,37.654316 127.06014,37.654346 127.06022,37.654366 127.06027,37.654385 127.0603,37.654404 127.06031,37.654415"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 45,
                                        "description": "노원역  7번출구 에서 횡단보도 후 보행자도로 을 따라 45m 이동 ",
                                        "linestring": "127.06031,37.654415 127.06079,37.65452"
                                    },
                                    {
                                        "streetName": "동일로",
                                        "distance": 23,
                                        "description": "노원역  4번출구 에서 좌회전 후 동일로 을 따라 23m 이동 ",
                                        "linestring": "127.06079,37.65452 127.06078,37.65452 127.06076,37.654533 127.06073,37.654568 127.06072,37.654602 127.0607,37.654705"
                                    }
                                ]
                            },
                            {
                                "mode": "SUBWAY",
                                "routeColor": "747F00",
                                "sectionTime": 1299,
                                "route": "수도권7호선",
                                "routeId": "110071024",
                                "distance": 11419,
                                "service": 1,
                                "start": {
                                    "name": "노원",
                                    "lon": 127.06053055555556,
                                    "lat": 37.65468055555556
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "노원",
                                            "lon": "127.060531",
                                            "lat": "37.654681",
                                            "stationID": "110705"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "중계",
                                            "lon": "127.064147",
                                            "lat": "37.645022",
                                            "stationID": "110706"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "하계",
                                            "lon": "127.067978",
                                            "lat": "37.636497",
                                            "stationID": "110707"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "공릉",
                                            "lon": "127.073000",
                                            "lat": "37.625603",
                                            "stationID": "110708"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "태릉입구",
                                            "lon": "127.075331",
                                            "lat": "37.618539",
                                            "stationID": "110709"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "먹골",
                                            "lon": "127.077717",
                                            "lat": "37.610828",
                                            "stationID": "110710"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "중화",
                                            "lon": "127.079306",
                                            "lat": "37.602556",
                                            "stationID": "110711"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "상봉",
                                            "lon": "127.085581",
                                            "lat": "37.596225",
                                            "stationID": "110712"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "면목",
                                            "lon": "127.087564",
                                            "lat": "37.588539",
                                            "stationID": "110713"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "사가정",
                                            "lon": "127.088531",
                                            "lat": "37.581058",
                                            "stationID": "110714"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "용마산",
                                            "lon": "127.086833",
                                            "lat": "37.573797",
                                            "stationID": "110715"
                                        },
                                        {
                                            "index": 11,
                                            "stationName": "중곡",
                                            "lon": "127.084250",
                                            "lat": "37.565825",
                                            "stationID": "110716"
                                        },
                                        {
                                            "index": 12,
                                            "stationName": "군자",
                                            "lon": "127.079486",
                                            "lat": "37.557122",
                                            "stationID": "110717"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "군자",
                                    "lon": 127.07948611111111,
                                    "lat": 37.55712222222222
                                },
                                "type": 7,
                                "passShape": {
                                    "linestring": "127.060269,37.655633 127.061000,37.652947 127.061594,37.650742 127.061925,37.649503 127.061969,37.649331 127.062036,37.649158 127.063731,37.645889 127.064144,37.645019 127.065069,37.643092 127.065303,37.642583 127.067019,37.638678 127.068328,37.635703 127.068428,37.635475 127.071194,37.629333 127.071356,37.628997 127.072508,37.626664 127.073111,37.625361 127.073119,37.625344 127.073253,37.625000 127.073494,37.624322 127.075331,37.618539 127.075600,37.617694 127.075625,37.617625 127.076289,37.615725 127.076408,37.615378 127.077356,37.612508 127.077450,37.612158 127.077511,37.611842 127.077894,37.609944 127.077928,37.609786 127.078536,37.606753 127.079444,37.601811 127.079536,37.601300 127.079608,37.600906 127.079664,37.600700 127.079722,37.600519 127.079792,37.600367 127.079894,37.600183 127.080003,37.600044 127.080128,37.599919 127.080306,37.599778 127.080506,37.599644 127.084750,37.597417 127.084939,37.597294 127.085081,37.597181 127.085214,37.597058 127.085225,37.597047 127.085328,37.596925 127.085353,37.596878 127.085397,37.596797 127.085483,37.596589 127.085567,37.596328 127.085592,37.596228 127.086044,37.594369 127.086225,37.593678 127.087256,37.589744 127.087475,37.588878 127.087567,37.588542 127.087778,37.587783 127.088225,37.586464 127.088281,37.586256 127.088331,37.586006 127.088433,37.585228 127.088442,37.585136 127.088444,37.585047 127.088442,37.584958 127.088403,37.584578 127.088381,37.584219 127.088369,37.583819 127.088378,37.583639 127.088394,37.583461 127.088425,37.583281 127.088475,37.583058 127.088547,37.582703 127.088603,37.582381 127.088639,37.582111 127.088642,37.582097 127.088644,37.582081 127.088644,37.582067 127.088647,37.582053 127.088650,37.582036 127.088650,37.582022 127.088650,37.582006 127.088650,37.581992 127.088653,37.581978 127.088653,37.581961 127.088653,37.581947 127.088653,37.581931 127.088650,37.581917 127.088650,37.581903 127.088650,37.581889 127.088650,37.581872 127.088647,37.581858 127.088644,37.581842 127.088644,37.581828 127.088642,37.581814 127.088639,37.581797 127.088497,37.580836 127.088472,37.580661 127.088419,37.580275 127.087358,37.574492 127.087328,37.574369 127.087292,37.574261 127.086847,37.573789 127.086369,37.573286 127.086350,37.573250 127.086331,37.573214 127.086311,37.573178 127.086292,37.573139 127.086275,37.573103 127.086258,37.573064 127.086244,37.573025 127.086231,37.572986 127.086217,37.572950 127.086203,37.572908 127.086192,37.572869 127.086181,37.572831 127.086172,37.572792 127.086164,37.572753 127.086156,37.572714 127.086150,37.572672 127.086144,37.572633 127.086139,37.572594 127.086136,37.572553 127.086133,37.572514 127.086131,37.572472 127.086167,37.570269 127.086153,37.569911 127.086128,37.569556 127.086097,37.569378 127.086056,37.569203 127.086014,37.569053 127.085956,37.568906 127.085886,37.568753 127.085728,37.568450 127.084556,37.566378 127.084106,37.565561 127.081781,37.561333 127.080903,37.559681 127.079506,37.557161 127.079492,37.557139"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 84,
                                "distance": 90,
                                "start": {
                                    "name": "군자",
                                    "lon": 127.07948611111111,
                                    "lat": 37.55712222222222
                                },
                                "end": {
                                    "name": "군자",
                                    "lon": 127.07943611111111,
                                    "lat": 37.55718888888889
                                },
                                "passShape": {
                                    "linestring": "127.079486,37.557122 127.079475,37.557169 127.079319,37.557231 127.079222,37.557056 127.078947,37.557164 127.078922,37.557164 127.079436,37.557189"
                                }
                            },
                            {
                                "mode": "SUBWAY",
                                "routeColor": "996CAC",
                                "sectionTime": 1025,
                                "route": "수도권5호선",
                                "routeId": "110051006",
                                "distance": 8337,
                                "service": 1,
                                "start": {
                                    "name": "군자",
                                    "lon": 127.07943611111111,
                                    "lat": 37.55718888888889
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "군자",
                                            "lon": "127.079436",
                                            "lat": "37.557189",
                                            "stationID": "110535"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "장한평",
                                            "lon": "127.064636",
                                            "lat": "37.561483",
                                            "stationID": "110534"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "답십리",
                                            "lon": "127.052553",
                                            "lat": "37.566964",
                                            "stationID": "110533"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "마장",
                                            "lon": "127.042619",
                                            "lat": "37.565906",
                                            "stationID": "110532"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "왕십리",
                                            "lon": "127.037189",
                                            "lat": "37.561942",
                                            "stationID": "110531"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "행당",
                                            "lon": "127.029544",
                                            "lat": "37.557364",
                                            "stationID": "110530"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "신금호",
                                            "lon": "127.020683",
                                            "lat": "37.554472",
                                            "stationID": "110529"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "청구",
                                            "lon": "127.013942",
                                            "lat": "37.560197",
                                            "stationID": "110528"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "동대문역사문화공원",
                                            "lon": "127.005508",
                                            "lat": "37.564675",
                                            "stationID": "110527"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "을지로4가",
                                            "lon": "126.998075",
                                            "lat": "37.567369",
                                            "stationID": "110526"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "을지로4가",
                                    "lon": 126.998075,
                                    "lat": 37.567369444444445
                                },
                                "type": 5,
                                "passShape": {
                                    "linestring": "127.079506,37.557161 127.079056,37.557333 127.075564,37.558686 127.071383,37.560378 127.071131,37.560458 127.070814,37.560544 127.070533,37.560606 127.069183,37.560800 127.065286,37.561394 127.063825,37.561592 127.061669,37.561886 127.059942,37.562139 127.059831,37.562164 127.059719,37.562189 127.059608,37.562219 127.059500,37.562250 127.059389,37.562283 127.059283,37.562317 127.059175,37.562356 127.059069,37.562394 127.058967,37.562433 127.058864,37.562478 127.058761,37.562522 127.058661,37.562569 127.058561,37.562617 127.058464,37.562669 127.058369,37.562719 127.058275,37.562775 127.058181,37.562831 127.058089,37.562889 127.058000,37.562947 127.057914,37.563008 127.057828,37.563069 127.052553,37.566964 127.051028,37.568089 127.050875,37.568189 127.050717,37.568283 127.050553,37.568369 127.050383,37.568453 127.050211,37.568528 127.050033,37.568594 127.049850,37.568656 127.049667,37.568708 127.049478,37.568756 127.049286,37.568794 127.049092,37.568825 127.048897,37.568850 127.048700,37.568864 127.048503,37.568872 127.048306,37.568872 127.048108,37.568867 127.047911,37.568850 127.047814,37.568839 127.047717,37.568828 127.047522,37.568797 127.047331,37.568758 127.047142,37.568714 127.047044,37.568675 127.046869,37.568608 127.046658,37.568517 127.046469,37.568417 127.046308,37.568328 127.043956,37.566769 127.042856,37.566058 127.042214,37.565644 127.041961,37.565467 127.038317,37.562653 127.038308,37.562647 127.037650,37.562228 127.037189,37.561942 127.036264,37.561367 127.035900,37.561136 127.032717,37.559119 127.031258,37.558211 127.030981,37.558056 127.030203,37.557675 127.029547,37.557358 127.027033,37.556158 127.026842,37.556072 127.026517,37.555939 127.026233,37.555833 127.025817,37.555694 127.022497,37.554678 127.022458,37.554664 127.022419,37.554650 127.022381,37.554639 127.022342,37.554625 127.022303,37.554614 127.022264,37.554603 127.022222,37.554592 127.022183,37.554581 127.022142,37.554569 127.022103,37.554558 127.022064,37.554550 127.022022,37.554542 127.021981,37.554531 127.021942,37.554522 127.021900,37.554514 127.021861,37.554506 127.021819,37.554497 127.021778,37.554489 127.021739,37.554483 127.021697,37.554475 127.021656,37.554469 127.021544,37.554458 127.020683,37.554472 127.020583,37.554475 127.020375,37.554508 127.020028,37.554631 127.019819,37.554700 127.019808,37.554706 127.019800,37.554711 127.019789,37.554717 127.019778,37.554722 127.019767,37.554728 127.019758,37.554733 127.019747,37.554739 127.019739,37.554744 127.019728,37.554750 127.019719,37.554756 127.019708,37.554764 127.019700,37.554769 127.019692,37.554775 127.019683,37.554781 127.019675,37.554789 127.019664,37.554794 127.019656,37.554803 127.019647,37.554808 127.019639,37.554817 127.019631,37.554825 127.019622,37.554831 127.019425,37.555039 127.019161,37.555331 127.018647,37.555922 127.017517,37.557358 127.016708,37.558319 127.015667,37.559456 127.015656,37.559467 127.015644,37.559478 127.015631,37.559492 127.015619,37.559503 127.015608,37.559514 127.015594,37.559525 127.015583,37.559533 127.015569,37.559544 127.015556,37.559556 127.015542,37.559564 127.015528,37.559575 127.015514,37.559583 127.015497,37.559592 127.015483,37.559600 127.015467,37.559608 127.015453,37.559617 127.015436,37.559622 127.015419,37.559631 127.015403,37.559639 127.015386,37.559644 127.015369,37.559650 127.014625,37.559933 127.013942,37.560197 127.013783,37.560256 127.013461,37.560381 127.012797,37.560614 127.012167,37.560814 127.011450,37.561019 127.011408,37.561033 127.011369,37.561044 127.011333,37.561058 127.011294,37.561075 127.011256,37.561089 127.011219,37.561103 127.011181,37.561119 127.011144,37.561133 127.011108,37.561153 127.011072,37.561169 127.011036,37.561186 127.011000,37.561206 127.010964,37.561222 127.010931,37.561242 127.010894,37.561261 127.010861,37.561281 127.010828,37.561303 127.010794,37.561322 127.010764,37.561344 127.010731,37.561367 127.010700,37.561389 127.007014,37.564231 127.006964,37.564269 127.006936,37.564289 127.006908,37.564308 127.006881,37.564328 127.006850,37.564344 127.006819,37.564361 127.006792,37.564378 127.006758,37.564394 127.006728,37.564408 127.006694,37.564425 127.006664,37.564439 127.006631,37.564450 127.006597,37.564464 127.006564,37.564475 127.006528,37.564486 127.006494,37.564494 127.006458,37.564506 127.006425,37.564514 127.006389,37.564522 127.006353,37.564531 127.006317,37.564536 127.006281,37.564542 127.005667,37.564653 127.005508,37.564675 127.005044,37.564733 127.004317,37.564756 127.003350,37.564683 127.001658,37.564586 127.000783,37.564528 127.000725,37.564525 127.000650,37.564531 127.000558,37.564542 127.000483,37.564553 127.000419,37.564567 127.000275,37.564611 127.000133,37.564661 126.999994,37.564714 126.999856,37.564772 126.999722,37.564836 126.999594,37.564903 126.999467,37.564975 126.999344,37.565053 126.999228,37.565131 126.999114,37.565217 126.999006,37.565306 126.998903,37.565394 126.998803,37.565492 126.998708,37.565589 126.998622,37.565692 126.998539,37.565797 126.998464,37.565903 126.998392,37.566014 126.998328,37.566125 126.998267,37.566242 126.998217,37.566356 126.998181,37.566472 126.998153,37.566642 126.998108,37.566919 126.998067,37.567369"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 795,
                                "distance": 940,
                                "start": {
                                    "name": "을지로4가",
                                    "lon": 126.998075,
                                    "lat": 37.567369444444445
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 81,
                                        "description": "81m 이동",
                                        "linestring": "126.998055,37.567368 126.998055,37.567326 126.998116,37.566643"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 2,
                                        "description": "을지로4가역 에서 우회전 후 2m 이동 ",
                                        "linestring": "126.998116,37.566643 126.9981,37.566643"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 30,
                                        "description": "을지로4가역 에서 좌회전 후 30m 이동 ",
                                        "linestring": "126.9981,37.566643 126.9979,37.566425"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 22,
                                        "description": "좌회전 후 22m 이동 ",
                                        "linestring": "126.9979,37.566425 126.99798,37.566376 126.997986,37.566273 126.998,37.56626"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 27,
                                        "description": "을지로4가역  9번출구 에서 우회전 후 보행자도로 을 따라 27m 이동 ",
                                        "linestring": "126.998,37.56626 126.998024,37.566017"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 23,
                                        "description": "건축사사무소엠앤케이 에서 횡단보도 후 보행자도로 을 따라 23m 이동 ",
                                        "linestring": "126.998085,37.564423 126.998116,37.56421"
                                    },
                                    {
                                        "streetName": "창경궁로",
                                        "distance": 194,
                                        "description": "우리은행 중구청출장소 에서 좌회전 후 창경궁로 을 따라 194m 이동 ",
                                        "linestring": "126.998116,37.56421 126.99816,37.564175 126.99819,37.564144 126.99821,37.56413 126.99821,37.56413 126.99823,37.563793 126.99826,37.563404 126.99827,37.563274 126.99828,37.563087 126.9983,37.562954 126.998314,37.56286 126.99834,37.5625"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 30,
                                        "description": "횡단보도 후 보행자도로 을 따라 30m 이동 ",
                                        "linestring": "126.99821,37.56232 126.99826,37.56205"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 200,
                                        "description": "옛날5가홍탁집 에서 우회전 후 퇴계로 을 따라 200m 이동 ",
                                        "linestring": "126.99826,37.56205 126.99788,37.561966 126.997604,37.561905 126.9974,37.56186 126.99737,37.56184 126.99734,37.56183 126.99671,37.5617 126.99657,37.56167 126.99634,37.561604 126.99614,37.561546 126.9961,37.561535"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 18,
                                        "description": "횡단보도 후 보행자도로 을 따라 18m 이동 ",
                                        "linestring": "126.9961,37.561535 126.9959,37.561493"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 108,
                                        "description": "직진 후 퇴계로 을 따라 108m 이동 ",
                                        "linestring": "126.9959,37.561493 126.99578,37.56146 126.99559,37.56142 126.99555,37.561413 126.995125,37.56132 126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 1806,
                        "transferCount": 1,
                        "totalDistance": 21469,
                        "pathType": 1,
                        "totalWalkDistance": 2047
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1600,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 5537,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 186,
                                "distance": 221,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동동아아파트",
                                    "lon": 127.05145,
                                    "lat": 37.65143888888889
                                },
                                "steps": [
                                    {
                                        "streetName": "노해로",
                                        "distance": 83,
                                        "description": "노해로 을 따라 83m 이동",
                                        "linestring": "127.05074,37.653175 127.05075,37.653145 127.05085,37.65288 127.05087,37.652847 127.050896,37.652817 127.050964,37.65261 127.050934,37.65258 127.05084,37.652485"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 35,
                                        "description": "KB국민은행 창동지점 에서 좌측 횡단보도 후 보행자도로 을 따라 35m 이동 ",
                                        "linestring": "127.05084,37.652485 127.05095,37.65218"
                                    },
                                    {
                                        "streetName": "노해로",
                                        "distance": 21,
                                        "description": "창동동아우편취급국 에서 직진 후 노해로 을 따라 21m 이동 ",
                                        "linestring": "127.05095,37.65218 127.050995,37.65219 127.05108,37.652187 127.05111,37.652172 127.05115,37.65214 127.051155,37.652134"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 82,
                                        "description": ", 82m",
                                        "linestring": "127.051155,37.652134 127.05118,37.652103 127.05119,37.65208 127.05126,37.65197 127.05132,37.651726 127.051384,37.65149 127.05141,37.65143"
                                    }
                                ]
                            },
                            {
                                "mode": "BUS",
                                "routeColor": "53B332",
                                "sectionTime": 598,
                                "route": "지선:1120",
                                "routeId": "11656001",
                                "distance": 1647,
                                "service": 1,
                                "start": {
                                    "name": "창동동아아파트",
                                    "lon": 127.05145,
                                    "lat": 37.65143888888889
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동동아아파트",
                                            "lon": "127.051450",
                                            "lat": "37.651439",
                                            "stationID": "778472"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "창동주공19단지",
                                            "lon": "127.052072",
                                            "lat": "37.649247",
                                            "stationID": "778358"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "창동주공18단지",
                                            "lon": "127.052797",
                                            "lat": "37.647283",
                                            "stationID": "778291"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "창동주공17단지",
                                            "lon": "127.053856",
                                            "lat": "37.645819",
                                            "stationID": "778216"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "마들근린공원.노원에코센터",
                                            "lon": "127.059539",
                                            "lat": "37.645042",
                                            "stationID": "778182"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "중계역2번출구",
                                            "lon": "127.064842",
                                            "lat": "37.645689",
                                            "stationID": "778211"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "중계역2번출구",
                                    "lon": 127.06484166666667,
                                    "lat": 37.64568888888889
                                },
                                "type": 12,
                                "passShape": {
                                    "linestring": "127.051483,37.651464 127.051706,37.650764 127.051833,37.650050 127.051883,37.649861 127.052106,37.649272 127.052789,37.647458 127.052842,37.647289 127.052856,37.647239 127.052878,37.647011 127.052822,37.646128 127.052892,37.645983 127.053844,37.645853 127.056778,37.645456 127.056953,37.645431 127.059531,37.645078 127.060286,37.644975 127.060794,37.644906 127.061481,37.644814 127.061675,37.644811 127.061867,37.644839 127.063856,37.645439 127.064025,37.645489 127.064844,37.645725"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 0,
                                "distance": 0,
                                "start": {
                                    "name": "중계역2번출구",
                                    "lon": 127.06484166666667,
                                    "lat": 37.64568888888889
                                },
                                "end": {
                                    "name": "중계역2번출구",
                                    "lon": 127.06484166666667,
                                    "lat": 37.64568888888889
                                },
                                "passShape": {
                                    "linestring": "127.064842,37.645689 127.064842,37.645689"
                                }
                            },
                            {
                                "mode": "BUS",
                                "routeColor": "0068B7",
                                "sectionTime": 4044,
                                "route": "간선:100",
                                "routeId": "11421001",
                                "distance": 12704,
                                "service": 1,
                                "start": {
                                    "name": "중계역2번출구",
                                    "lon": 127.06484166666667,
                                    "lat": 37.64568888888889
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "중계역2번출구",
                                            "lon": "127.064842",
                                            "lat": "37.645689",
                                            "stationID": "778211"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "중계3단지목련아파트",
                                            "lon": "127.067781",
                                            "lat": "37.647425",
                                            "stationID": "778293"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "목련아파트상가",
                                            "lon": "127.070000",
                                            "lat": "37.646658",
                                            "stationID": "778263"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "중계목화아파트4단지",
                                            "lon": "127.071408",
                                            "lat": "37.643617",
                                            "stationID": "778113"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "노원경찰서",
                                            "lon": "127.072219",
                                            "lat": "37.641878",
                                            "stationID": "778059"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "하계1동주민센터",
                                            "lon": "127.072875",
                                            "lat": "37.640461",
                                            "stationID": "778006"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "골마을근린공원",
                                            "lon": "127.074233",
                                            "lat": "37.638303",
                                            "stationID": "777940"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "하계역",
                                            "lon": "127.069500",
                                            "lat": "37.636856",
                                            "stationID": "777884"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "하계우성아파트",
                                            "lon": "127.066606",
                                            "lat": "37.635114",
                                            "stationID": "777830"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "하계극동아파트",
                                            "lon": "127.064525",
                                            "lat": "37.633786",
                                            "stationID": "777757"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "월계보건지소",
                                            "lon": "127.061411",
                                            "lat": "37.631833",
                                            "stationID": "777672"
                                        },
                                        {
                                            "index": 11,
                                            "stationName": "인덕대학",
                                            "lon": "127.055236",
                                            "lat": "37.627931",
                                            "stationID": "777520"
                                        },
                                        {
                                            "index": 12,
                                            "stationName": "월계주공108동앞롯데캐슬루나아파트",
                                            "lon": "127.052600",
                                            "lat": "37.626267",
                                            "stationID": "777443"
                                        },
                                        {
                                            "index": 13,
                                            "stationName": "오현초등학교",
                                            "lon": "127.048067",
                                            "lat": "37.623425",
                                            "stationID": "777320"
                                        },
                                        {
                                            "index": 14,
                                            "stationName": "꿈의숲주차장입구",
                                            "lon": "127.045369",
                                            "lat": "37.620942",
                                            "stationID": "777245"
                                        },
                                        {
                                            "index": 15,
                                            "stationName": "북서울꿈의숲",
                                            "lon": "127.044133",
                                            "lat": "37.619039",
                                            "stationID": "777161"
                                        },
                                        {
                                            "index": 16,
                                            "stationName": "송중동한일유엔아이",
                                            "lon": "127.038019",
                                            "lat": "37.613856",
                                            "stationID": "776892"
                                        },
                                        {
                                            "index": 17,
                                            "stationName": "창문여고앞",
                                            "lon": "127.035544",
                                            "lat": "37.611947",
                                            "stationID": "776799"
                                        },
                                        {
                                            "index": 18,
                                            "stationName": "숭곡초등학교입구",
                                            "lon": "127.031844",
                                            "lat": "37.610006",
                                            "stationID": "776696"
                                        },
                                        {
                                            "index": 19,
                                            "stationName": "길음2동주민센터",
                                            "lon": "127.028131",
                                            "lat": "37.606906",
                                            "stationID": "776571"
                                        },
                                        {
                                            "index": 20,
                                            "stationName": "길음뉴타운",
                                            "lon": "127.024219",
                                            "lat": "37.603722",
                                            "stationID": "776424"
                                        },
                                        {
                                            "index": 21,
                                            "stationName": "미아리고개.미아리예술극장",
                                            "lon": "127.021672",
                                            "lat": "37.598806",
                                            "stationID": "776162"
                                        },
                                        {
                                            "index": 22,
                                            "stationName": "돈암사거리.성신여대입구",
                                            "lon": "127.018219",
                                            "lat": "37.593944",
                                            "stationID": "775942"
                                        },
                                        {
                                            "index": 23,
                                            "stationName": "삼선교.한성대학교",
                                            "lon": "127.009192",
                                            "lat": "37.589928",
                                            "stationID": "775768"
                                        },
                                        {
                                            "index": 24,
                                            "stationName": "혜화동로터리.여운형활동터",
                                            "lon": "127.001658",
                                            "lat": "37.586281",
                                            "stationID": "775592"
                                        },
                                        {
                                            "index": 25,
                                            "stationName": "명륜3가.성대입구",
                                            "lon": "126.998453",
                                            "lat": "37.582908",
                                            "stationID": "758772"
                                        },
                                        {
                                            "index": 26,
                                            "stationName": "창경궁.서울대학교병원",
                                            "lon": "126.996506",
                                            "lat": "37.579175",
                                            "stationID": "758602"
                                        },
                                        {
                                            "index": 27,
                                            "stationName": "원남동",
                                            "lon": "126.997356",
                                            "lat": "37.574428",
                                            "stationID": "758413"
                                        },
                                        {
                                            "index": 28,
                                            "stationName": "광장시장",
                                            "lon": "126.997761",
                                            "lat": "37.569375",
                                            "stationID": "758160"
                                        },
                                        {
                                            "index": 29,
                                            "stationName": "을지로4가",
                                            "lon": "126.995967",
                                            "lat": "37.566664",
                                            "stationID": "758029"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "을지로4가",
                                    "lon": 126.99596666666666,
                                    "lat": 37.56666388888889
                                },
                                "type": 11,
                                "passShape": {
                                    "linestring": "127.064844,37.645725 127.066250,37.646133 127.066408,37.646206 127.066506,37.646278 127.067764,37.647458 127.069333,37.648928 127.069569,37.649094 127.069814,37.648800 127.069894,37.648644 127.069950,37.648356 127.069950,37.647767 127.069947,37.647181 127.069969,37.646981 127.070042,37.646675 127.070044,37.646661 127.070164,37.646367 127.070711,37.645219 127.071456,37.643611 127.071686,37.643108 127.071750,37.642975 127.072264,37.641869 127.072914,37.640478 127.072950,37.640403 127.073056,37.640217 127.073183,37.640039 127.073478,37.639717 127.073892,37.639378 127.074158,37.639208 127.074508,37.639022 127.075231,37.638725 127.074981,37.638575 127.074711,37.638447 127.074356,37.638306 127.074264,37.638275 127.074019,37.638194 127.073706,37.638128 127.073319,37.638086 127.072064,37.638031 127.071825,37.638003 127.071575,37.637950 127.071375,37.637883 127.071175,37.637800 127.070725,37.637533 127.070392,37.637336 127.070239,37.637244 127.069533,37.636833 127.068256,37.636083 127.068106,37.635992 127.066681,37.635075 127.066183,37.634756 127.066033,37.634661 127.064547,37.633756 127.064186,37.633536 127.061961,37.632131 127.061453,37.631819 127.061081,37.631594 127.060939,37.631506 127.060492,37.631183 127.058792,37.630108 127.057869,37.629497 127.057625,37.629400 127.056467,37.628667 127.055817,37.628253 127.055675,37.628164 127.055303,37.627931 127.055278,37.627917 127.054639,37.627514 127.053978,37.627094 127.052653,37.626253 127.052625,37.626233 127.052000,37.625836 127.051858,37.625747 127.051686,37.625639 127.050714,37.625017 127.049969,37.624483 127.049631,37.624281 127.049481,37.624200 127.048106,37.623408 127.047067,37.622811 127.046608,37.622494 127.046397,37.622303 127.046292,37.622214 127.045914,37.621794 127.045803,37.621644 127.045578,37.621242 127.045403,37.620914 127.044808,37.619811 127.044686,37.619614 127.044158,37.619008 127.044106,37.618950 127.043758,37.618628 127.043078,37.618128 127.040431,37.616242 127.040142,37.616011 127.039731,37.615611 127.038064,37.613844 127.037922,37.613694 127.037811,37.613567 127.037581,37.613256 127.037253,37.612861 127.037175,37.612786 127.037042,37.612694 127.035544,37.611911 127.035144,37.611700 127.034992,37.611619 127.033478,37.610817 127.033350,37.610758 127.031883,37.609989 127.030789,37.609414 127.030414,37.609217 127.030258,37.609128 127.030144,37.609050 127.029986,37.608906 127.029731,37.608633 127.028658,37.607378 127.028161,37.606878 127.028125,37.606842 127.026917,37.605811 127.025181,37.604389 127.024892,37.604153 127.024264,37.603711 127.024100,37.603594 127.022919,37.602967 127.022689,37.602822 127.022350,37.602556 127.022250,37.602394 127.022164,37.602147 127.022150,37.602086 127.021928,37.601194 127.021833,37.600697 127.021717,37.598811 127.021714,37.598781 127.021628,37.597881 127.021525,37.597400 127.021456,37.597183 127.021317,37.596814 127.021150,37.596519 127.020936,37.596269 127.020692,37.596044 127.018256,37.593925 127.017694,37.593433 127.017467,37.593264 127.017203,37.593097 127.016975,37.592972 127.016561,37.592792 127.016389,37.592725 127.015978,37.592600 127.015564,37.592533 127.014739,37.592444 127.014564,37.592417 127.014300,37.592347 127.014081,37.592281 127.013886,37.592206 127.013244,37.591908 127.013089,37.591836 127.010875,37.590675 127.009381,37.589975 127.009228,37.589908 127.006175,37.588575 127.006008,37.588508 127.004692,37.588008 127.003494,37.587592 127.002994,37.587367 127.002525,37.587075 127.002189,37.586803 127.001989,37.586614 127.001703,37.586275 127.001417,37.585936 127.001361,37.585844 127.000947,37.585369 127.000853,37.585283 127.000361,37.584714 127.000000,37.584336 126.999506,37.583819 126.998981,37.583331 126.998744,37.583119 126.998500,37.582900 126.997808,37.582289 126.996719,37.581367 126.996581,37.581233 126.996489,37.581108 126.996417,37.580933 126.996358,37.580631 126.996367,37.580456 126.996550,37.579186 126.996642,37.578553 126.997019,37.577325 126.997128,37.576919 126.997150,37.576692 126.997244,37.576006 126.997264,37.575853 126.997356,37.575003 126.997400,37.574425 126.997653,37.571167 126.997675,37.570808 126.997683,37.570664 126.997800,37.569394 126.997831,37.569025 126.997858,37.568697 126.997992,37.567111 126.997575,37.566750 126.997514,37.566708 126.995964,37.566628"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 709,
                                "distance": 853,
                                "start": {
                                    "name": "을지로4가",
                                    "lon": 126.99596666666666,
                                    "lat": 37.56666388888889
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "을지로",
                                        "distance": 40,
                                        "description": "을지로 을 따라 40m 이동",
                                        "linestring": "126.995964,37.56666 126.99573,37.56665 126.99561,37.566643 126.99551,37.566643"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 29,
                                        "description": "제이미디어 에서 좌측 횡단보도 후 보행자도로 을 따라 29m 이동 ",
                                        "linestring": "126.99551,37.566643 126.99552,37.566387"
                                    },
                                    {
                                        "streetName": "을지로",
                                        "distance": 79,
                                        "description": "참조은약국 에서 좌회전 후 을지로 을 따라 79m 이동 ",
                                        "linestring": "126.99552,37.566387 126.995674,37.566395 126.99575,37.5664 126.99586,37.566406 126.996086,37.566418 126.9964,37.56643 126.99642,37.566433"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 247,
                                        "description": "NH농협은행 을지센트럴지점 에서 2시 방향 우회전 후 247m 이동 ",
                                        "linestring": "126.99642,37.566433 126.99646,37.566387 126.99648,37.566154 126.99653,37.56574 126.99653,37.565712 126.99654,37.56559 126.996544,37.56551 126.996544,37.565453 126.99654,37.565426 126.99653,37.565395 126.99647,37.565292 126.99622,37.56499 126.99614,37.564884 126.99611,37.564842 126.996086,37.564796 126.99608,37.56474 126.9961,37.564342 126.99609,37.564323"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 16,
                                        "description": "예진문화기획사 에서 횡단보도 후 보행자도로 을 따라 16m 이동 ",
                                        "linestring": "126.99609,37.564323 126.9961,37.56418"
                                    },
                                    {
                                        "streetName": "마른내로",
                                        "distance": 10,
                                        "description": "황평집 에서 우회전 후 마른내로 을 따라 10m 이동 ",
                                        "linestring": "126.9961,37.56418 126.996056,37.56418 126.99598,37.564175"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 258,
                                        "description": "황평집 에서 좌회전 후 보행자도로 을 따라 258m 이동 ",
                                        "linestring": "126.99598,37.564175 126.995995,37.56406 126.996025,37.563606 126.99604,37.563484 126.996124,37.562576 126.99614,37.56239 126.9962,37.56186"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 47,
                                        "description": "우회전 후 퇴계로 을 따라 47m 이동 ",
                                        "linestring": "126.9962,37.56186 126.99605,37.56182 126.995834,37.561768 126.9957,37.56173"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 31,
                                        "description": "서울이비인후과의원 에서 좌측 횡단보도 후 보행자도로 을 따라 31m 이동 ",
                                        "linestring": "126.9957,37.56173 126.99578,37.56146"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 96,
                                        "description": "충무로역  1번출구 에서 우회전 후 퇴계로 을 따라 96m 이동 ",
                                        "linestring": "126.99578,37.56146 126.99559,37.56142 126.99555,37.561413 126.995125,37.56132 126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 895,
                        "transferCount": 1,
                        "totalDistance": 15169,
                        "pathType": 2,
                        "totalWalkDistance": 1074
                    },
                    {
                        "fare": {
                            "regular": {
                                "totalFare": 1700,
                                "currency": {
                                    "symbol": "￦",
                                    "currency": "원",
                                    "currencyCode": "KRW"
                                }
                            }
                        },
                        "totalTime": 5945,
                        "legs": [
                            {
                                "mode": "WALK",
                                "sectionTime": 74,
                                "distance": 105,
                                "start": {
                                    "name": "출발지",
                                    "lon": 127.0507436148,
                                    "lat": 37.653177207
                                },
                                "end": {
                                    "name": "창동역동측",
                                    "lon": 127.050025,
                                    "lat": 37.6536
                                },
                                "steps": [
                                    {
                                        "streetName": "",
                                        "distance": 52,
                                        "description": "52m 이동",
                                        "linestring": "127.05074,37.653175 127.05066,37.65342 127.05059,37.653625"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 53,
                                        "description": "좌회전 후 53m 이동 ",
                                        "linestring": "127.05059,37.653625 127.05059,37.653633 127.05045,37.653675 127.05042,37.653687 127.050026,37.653584"
                                    }
                                ]
                            },
                            {
                                "mode": "BUS",
                                "routeColor": "53B332",
                                "sectionTime": 811,
                                "route": "마을:노원15",
                                "routeId": "11669001",
                                "distance": 2208,
                                "service": 1,
                                "start": {
                                    "name": "창동역동측",
                                    "lon": 127.050025,
                                    "lat": 37.6536
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "창동역동측",
                                            "lon": "127.050025",
                                            "lat": "37.653600",
                                            "stationID": "829232"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "노원구청",
                                            "lon": "127.057503",
                                            "lat": "37.654381",
                                            "stationID": "778588"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "노원역8번출구",
                                            "lon": "127.059428",
                                            "lat": "37.655350",
                                            "stationID": "778644"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "상계주공3단지",
                                            "lon": "127.061031",
                                            "lat": "37.652019",
                                            "stationID": "778499"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "상계주공2단지",
                                            "lon": "127.061725",
                                            "lat": "37.649469",
                                            "stationID": "778366"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "상계주공1단지",
                                            "lon": "127.062831",
                                            "lat": "37.647281",
                                            "stationID": "778290"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "중계역",
                                            "lon": "127.064431",
                                            "lat": "37.643964",
                                            "stationID": "778127"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "중계역",
                                    "lon": 127.06443055555556,
                                    "lat": 37.64396388888889
                                },
                                "type": 3,
                                "passShape": {
                                    "linestring": "127.049931,37.653678 127.049931,37.653678 127.050086,37.653717 127.050242,37.653756 127.050553,37.653831 127.050728,37.653872 127.052242,37.654250 127.052267,37.654253 127.052569,37.654317 127.053231,37.654403 127.053247,37.652964 127.053431,37.652844 127.054239,37.652925 127.054969,37.653019 127.055292,37.653058 127.057633,37.653567 127.057672,37.653725 127.057464,37.654364 127.057281,37.654919 127.059394,37.655375 127.060183,37.655542 127.060389,37.654778 127.060506,37.654339 127.060544,37.654197 127.061122,37.652028 127.061300,37.651353 127.061756,37.649644 127.061806,37.649500 127.061814,37.649478 127.062031,37.649033 127.062897,37.647331 127.063792,37.645572 127.063856,37.645439 127.064522,37.643956"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 182,
                                "distance": 175,
                                "start": {
                                    "name": "중계역",
                                    "lon": 127.06443055555556,
                                    "lat": 37.64396388888889
                                },
                                "end": {
                                    "name": "중계역",
                                    "lon": 127.06523888888889,
                                    "lat": 37.64299722222222
                                },
                                "passShape": {
                                    "linestring": "127.064431,37.643964 127.064550,37.643614 127.064508,37.643542 127.064464,37.643528 127.064517,37.643439 127.064553,37.643444 127.064631,37.643428 127.064656,37.643375 127.065044,37.643481 127.065139,37.643275 127.065156,37.643258 127.065181,37.643242 127.065214,37.643206 127.065231,37.643169 127.065239,37.642997"
                                }
                            },
                            {
                                "mode": "BUS",
                                "routeColor": "0068B7",
                                "sectionTime": 4169,
                                "route": "간선:100",
                                "routeId": "11421001",
                                "distance": 13005,
                                "service": 1,
                                "start": {
                                    "name": "중계역",
                                    "lon": 127.06523888888889,
                                    "lat": 37.64299722222222
                                },
                                "passStopList": {
                                    "stationList": [
                                        {
                                            "index": 0,
                                            "stationName": "중계역",
                                            "lon": "127.065239",
                                            "lat": "37.642997",
                                            "stationID": "778100"
                                        },
                                        {
                                            "index": 1,
                                            "stationName": "중계역2번출구",
                                            "lon": "127.064842",
                                            "lat": "37.645689",
                                            "stationID": "778211"
                                        },
                                        {
                                            "index": 2,
                                            "stationName": "중계3단지목련아파트",
                                            "lon": "127.067781",
                                            "lat": "37.647425",
                                            "stationID": "778293"
                                        },
                                        {
                                            "index": 3,
                                            "stationName": "목련아파트상가",
                                            "lon": "127.070000",
                                            "lat": "37.646658",
                                            "stationID": "778263"
                                        },
                                        {
                                            "index": 4,
                                            "stationName": "중계목화아파트4단지",
                                            "lon": "127.071408",
                                            "lat": "37.643617",
                                            "stationID": "778113"
                                        },
                                        {
                                            "index": 5,
                                            "stationName": "노원경찰서",
                                            "lon": "127.072219",
                                            "lat": "37.641878",
                                            "stationID": "778059"
                                        },
                                        {
                                            "index": 6,
                                            "stationName": "하계1동주민센터",
                                            "lon": "127.072875",
                                            "lat": "37.640461",
                                            "stationID": "778006"
                                        },
                                        {
                                            "index": 7,
                                            "stationName": "골마을근린공원",
                                            "lon": "127.074233",
                                            "lat": "37.638303",
                                            "stationID": "777940"
                                        },
                                        {
                                            "index": 8,
                                            "stationName": "하계역",
                                            "lon": "127.069500",
                                            "lat": "37.636856",
                                            "stationID": "777884"
                                        },
                                        {
                                            "index": 9,
                                            "stationName": "하계우성아파트",
                                            "lon": "127.066606",
                                            "lat": "37.635114",
                                            "stationID": "777830"
                                        },
                                        {
                                            "index": 10,
                                            "stationName": "하계극동아파트",
                                            "lon": "127.064525",
                                            "lat": "37.633786",
                                            "stationID": "777757"
                                        },
                                        {
                                            "index": 11,
                                            "stationName": "월계보건지소",
                                            "lon": "127.061411",
                                            "lat": "37.631833",
                                            "stationID": "777672"
                                        },
                                        {
                                            "index": 12,
                                            "stationName": "인덕대학",
                                            "lon": "127.055236",
                                            "lat": "37.627931",
                                            "stationID": "777520"
                                        },
                                        {
                                            "index": 13,
                                            "stationName": "월계주공108동앞롯데캐슬루나아파트",
                                            "lon": "127.052600",
                                            "lat": "37.626267",
                                            "stationID": "777443"
                                        },
                                        {
                                            "index": 14,
                                            "stationName": "오현초등학교",
                                            "lon": "127.048067",
                                            "lat": "37.623425",
                                            "stationID": "777320"
                                        },
                                        {
                                            "index": 15,
                                            "stationName": "꿈의숲주차장입구",
                                            "lon": "127.045369",
                                            "lat": "37.620942",
                                            "stationID": "777245"
                                        },
                                        {
                                            "index": 16,
                                            "stationName": "북서울꿈의숲",
                                            "lon": "127.044133",
                                            "lat": "37.619039",
                                            "stationID": "777161"
                                        },
                                        {
                                            "index": 17,
                                            "stationName": "송중동한일유엔아이",
                                            "lon": "127.038019",
                                            "lat": "37.613856",
                                            "stationID": "776892"
                                        },
                                        {
                                            "index": 18,
                                            "stationName": "창문여고앞",
                                            "lon": "127.035544",
                                            "lat": "37.611947",
                                            "stationID": "776799"
                                        },
                                        {
                                            "index": 19,
                                            "stationName": "숭곡초등학교입구",
                                            "lon": "127.031844",
                                            "lat": "37.610006",
                                            "stationID": "776696"
                                        },
                                        {
                                            "index": 20,
                                            "stationName": "길음2동주민센터",
                                            "lon": "127.028131",
                                            "lat": "37.606906",
                                            "stationID": "776571"
                                        },
                                        {
                                            "index": 21,
                                            "stationName": "길음뉴타운",
                                            "lon": "127.024219",
                                            "lat": "37.603722",
                                            "stationID": "776424"
                                        },
                                        {
                                            "index": 22,
                                            "stationName": "미아리고개.미아리예술극장",
                                            "lon": "127.021672",
                                            "lat": "37.598806",
                                            "stationID": "776162"
                                        },
                                        {
                                            "index": 23,
                                            "stationName": "돈암사거리.성신여대입구",
                                            "lon": "127.018219",
                                            "lat": "37.593944",
                                            "stationID": "775942"
                                        },
                                        {
                                            "index": 24,
                                            "stationName": "삼선교.한성대학교",
                                            "lon": "127.009192",
                                            "lat": "37.589928",
                                            "stationID": "775768"
                                        },
                                        {
                                            "index": 25,
                                            "stationName": "혜화동로터리.여운형활동터",
                                            "lon": "127.001658",
                                            "lat": "37.586281",
                                            "stationID": "775592"
                                        },
                                        {
                                            "index": 26,
                                            "stationName": "명륜3가.성대입구",
                                            "lon": "126.998453",
                                            "lat": "37.582908",
                                            "stationID": "758772"
                                        },
                                        {
                                            "index": 27,
                                            "stationName": "창경궁.서울대학교병원",
                                            "lon": "126.996506",
                                            "lat": "37.579175",
                                            "stationID": "758602"
                                        },
                                        {
                                            "index": 28,
                                            "stationName": "원남동",
                                            "lon": "126.997356",
                                            "lat": "37.574428",
                                            "stationID": "758413"
                                        },
                                        {
                                            "index": 29,
                                            "stationName": "광장시장",
                                            "lon": "126.997761",
                                            "lat": "37.569375",
                                            "stationID": "758160"
                                        },
                                        {
                                            "index": 30,
                                            "stationName": "을지로4가",
                                            "lon": "126.995967",
                                            "lat": "37.566664",
                                            "stationID": "758029"
                                        }
                                    ]
                                },
                                "end": {
                                    "name": "을지로4가",
                                    "lon": 126.99596666666666,
                                    "lat": 37.56666388888889
                                },
                                "type": 11,
                                "passShape": {
                                    "linestring": "127.065167,37.642953 127.064025,37.645489 127.064844,37.645725 127.066250,37.646133 127.066408,37.646206 127.066506,37.646278 127.067764,37.647458 127.069333,37.648928 127.069569,37.649094 127.069814,37.648800 127.069894,37.648644 127.069950,37.648356 127.069950,37.647767 127.069947,37.647181 127.069969,37.646981 127.070042,37.646675 127.070044,37.646661 127.070164,37.646367 127.070711,37.645219 127.071456,37.643611 127.071686,37.643108 127.071750,37.642975 127.072264,37.641869 127.072914,37.640478 127.072950,37.640403 127.073056,37.640217 127.073183,37.640039 127.073478,37.639717 127.073892,37.639378 127.074158,37.639208 127.074508,37.639022 127.075231,37.638725 127.074981,37.638575 127.074711,37.638447 127.074356,37.638306 127.074264,37.638275 127.074019,37.638194 127.073706,37.638128 127.073319,37.638086 127.072064,37.638031 127.071825,37.638003 127.071575,37.637950 127.071375,37.637883 127.071175,37.637800 127.070725,37.637533 127.070392,37.637336 127.070239,37.637244 127.069533,37.636833 127.068256,37.636083 127.068106,37.635992 127.066681,37.635075 127.066183,37.634756 127.066033,37.634661 127.064547,37.633756 127.064186,37.633536 127.061961,37.632131 127.061453,37.631819 127.061081,37.631594 127.060939,37.631506 127.060492,37.631183 127.058792,37.630108 127.057869,37.629497 127.057625,37.629400 127.056467,37.628667 127.055817,37.628253 127.055675,37.628164 127.055303,37.627931 127.055278,37.627917 127.054639,37.627514 127.053978,37.627094 127.052653,37.626253 127.052625,37.626233 127.052000,37.625836 127.051858,37.625747 127.051686,37.625639 127.050714,37.625017 127.049969,37.624483 127.049631,37.624281 127.049481,37.624200 127.048106,37.623408 127.047067,37.622811 127.046608,37.622494 127.046397,37.622303 127.046292,37.622214 127.045914,37.621794 127.045803,37.621644 127.045578,37.621242 127.045403,37.620914 127.044808,37.619811 127.044686,37.619614 127.044158,37.619008 127.044106,37.618950 127.043758,37.618628 127.043078,37.618128 127.040431,37.616242 127.040142,37.616011 127.039731,37.615611 127.038064,37.613844 127.037922,37.613694 127.037811,37.613567 127.037581,37.613256 127.037253,37.612861 127.037175,37.612786 127.037042,37.612694 127.035544,37.611911 127.035144,37.611700 127.034992,37.611619 127.033478,37.610817 127.033350,37.610758 127.031883,37.609989 127.030789,37.609414 127.030414,37.609217 127.030258,37.609128 127.030144,37.609050 127.029986,37.608906 127.029731,37.608633 127.028658,37.607378 127.028161,37.606878 127.028125,37.606842 127.026917,37.605811 127.025181,37.604389 127.024892,37.604153 127.024264,37.603711 127.024100,37.603594 127.022919,37.602967 127.022689,37.602822 127.022350,37.602556 127.022250,37.602394 127.022164,37.602147 127.022150,37.602086 127.021928,37.601194 127.021833,37.600697 127.021717,37.598811 127.021714,37.598781 127.021628,37.597881 127.021525,37.597400 127.021456,37.597183 127.021317,37.596814 127.021150,37.596519 127.020936,37.596269 127.020692,37.596044 127.018256,37.593925 127.017694,37.593433 127.017467,37.593264 127.017203,37.593097 127.016975,37.592972 127.016561,37.592792 127.016389,37.592725 127.015978,37.592600 127.015564,37.592533 127.014739,37.592444 127.014564,37.592417 127.014300,37.592347 127.014081,37.592281 127.013886,37.592206 127.013244,37.591908 127.013089,37.591836 127.010875,37.590675 127.009381,37.589975 127.009228,37.589908 127.006175,37.588575 127.006008,37.588508 127.004692,37.588008 127.003494,37.587592 127.002994,37.587367 127.002525,37.587075 127.002189,37.586803 127.001989,37.586614 127.001703,37.586275 127.001417,37.585936 127.001361,37.585844 127.000947,37.585369 127.000853,37.585283 127.000361,37.584714 127.000000,37.584336 126.999506,37.583819 126.998981,37.583331 126.998744,37.583119 126.998500,37.582900 126.997808,37.582289 126.996719,37.581367 126.996581,37.581233 126.996489,37.581108 126.996417,37.580933 126.996358,37.580631 126.996367,37.580456 126.996550,37.579186 126.996642,37.578553 126.997019,37.577325 126.997128,37.576919 126.997150,37.576692 126.997244,37.576006 126.997264,37.575853 126.997356,37.575003 126.997400,37.574425 126.997653,37.571167 126.997675,37.570808 126.997683,37.570664 126.997800,37.569394 126.997831,37.569025 126.997858,37.568697 126.997992,37.567111 126.997575,37.566750 126.997514,37.566708 126.995964,37.566628"
                                }
                            },
                            {
                                "mode": "WALK",
                                "sectionTime": 709,
                                "distance": 853,
                                "start": {
                                    "name": "을지로4가",
                                    "lon": 126.99596666666666,
                                    "lat": 37.56666388888889
                                },
                                "end": {
                                    "name": "도착지",
                                    "lon": 126.9947285429,
                                    "lat": 37.5612375854
                                },
                                "steps": [
                                    {
                                        "streetName": "을지로",
                                        "distance": 40,
                                        "description": "을지로 을 따라 40m 이동",
                                        "linestring": "126.995964,37.56666 126.99573,37.56665 126.99561,37.566643 126.99551,37.566643"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 29,
                                        "description": "제이미디어 에서 좌측 횡단보도 후 보행자도로 을 따라 29m 이동 ",
                                        "linestring": "126.99551,37.566643 126.99552,37.566387"
                                    },
                                    {
                                        "streetName": "을지로",
                                        "distance": 79,
                                        "description": "참조은약국 에서 좌회전 후 을지로 을 따라 79m 이동 ",
                                        "linestring": "126.99552,37.566387 126.995674,37.566395 126.99575,37.5664 126.99586,37.566406 126.996086,37.566418 126.9964,37.56643 126.99642,37.566433"
                                    },
                                    {
                                        "streetName": "",
                                        "distance": 247,
                                        "description": "NH농협은행 을지센트럴지점 에서 2시 방향 우회전 후 247m 이동 ",
                                        "linestring": "126.99642,37.566433 126.99646,37.566387 126.99648,37.566154 126.99653,37.56574 126.99653,37.565712 126.99654,37.56559 126.996544,37.56551 126.996544,37.565453 126.99654,37.565426 126.99653,37.565395 126.99647,37.565292 126.99622,37.56499 126.99614,37.564884 126.99611,37.564842 126.996086,37.564796 126.99608,37.56474 126.9961,37.564342 126.99609,37.564323"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 16,
                                        "description": "예진문화기획사 에서 횡단보도 후 보행자도로 을 따라 16m 이동 ",
                                        "linestring": "126.99609,37.564323 126.9961,37.56418"
                                    },
                                    {
                                        "streetName": "마른내로",
                                        "distance": 10,
                                        "description": "황평집 에서 우회전 후 마른내로 을 따라 10m 이동 ",
                                        "linestring": "126.9961,37.56418 126.996056,37.56418 126.99598,37.564175"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 258,
                                        "description": "황평집 에서 좌회전 후 보행자도로 을 따라 258m 이동 ",
                                        "linestring": "126.99598,37.564175 126.995995,37.56406 126.996025,37.563606 126.99604,37.563484 126.996124,37.562576 126.99614,37.56239 126.9962,37.56186"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 47,
                                        "description": "우회전 후 퇴계로 을 따라 47m 이동 ",
                                        "linestring": "126.9962,37.56186 126.99605,37.56182 126.995834,37.561768 126.9957,37.56173"
                                    },
                                    {
                                        "streetName": "보행자도로",
                                        "distance": 31,
                                        "description": "서울이비인후과의원 에서 좌측 횡단보도 후 보행자도로 을 따라 31m 이동 ",
                                        "linestring": "126.9957,37.56173 126.99578,37.56146"
                                    },
                                    {
                                        "streetName": "퇴계로",
                                        "distance": 96,
                                        "description": "충무로역  1번출구 에서 우회전 후 퇴계로 을 따라 96m 이동 ",
                                        "linestring": "126.99578,37.56146 126.99559,37.56142 126.99555,37.561413 126.995125,37.56132 126.99493,37.56128 126.99473,37.561237"
                                    }
                                ]
                            }
                        ],
                        "totalWalkTime": 965,
                        "transferCount": 1,
                        "totalDistance": 16081,
                        "pathType": 2,
                        "totalWalkDistance": 1133
                    }
                ]
            }
        }
    };
}