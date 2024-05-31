export interface IGetBusPosByVehIdResponse {
    comMsgHeader: ComMsgHeader;
    msgHeader: MsgHeader;
    msgBody: {
        itemList: BusPosition[];
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