export interface IGetTransitRoutesResponse {
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