export interface IGetStaionByRouteResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: GetStaionByRouteMsgBody;
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
