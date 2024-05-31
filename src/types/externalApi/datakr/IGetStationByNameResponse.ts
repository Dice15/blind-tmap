export interface IGetStationByNameResponse {
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