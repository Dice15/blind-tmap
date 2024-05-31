export interface IGetBusRouteListResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: GetBusRouteListMsgBody;
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