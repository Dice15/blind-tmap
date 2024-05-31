import { IGetBusPosByVehIdResponse } from '@/types/externalApi/datakr/IGetBusPosByVehIdResponse';
import axios, { AxiosResponse } from 'axios';
import DataKoreaService from './DataKoreaService';


export class BusPosByVehIdService {
    private constructor() { }


    public static async getBusPosByVehId(busVehId: string): Promise<IGetBusPosByVehIdResponse | null> {
        return this.getBusPosByVehIdByDataKr(busVehId)
            .then((response) => {
                return response.data;
            })
            .catch((error) => {
                console.error(error);
                return null;
            });
    }


    private static getBusPosByVehIdByDataKr(busVehId: string): Promise<AxiosResponse<IGetBusPosByVehIdResponse, any>> {
        return axios.get<IGetBusPosByVehIdResponse>(
            "http://ws.bus.go.kr/api/rest/buspos/getBusPosByVehId", {
            params: {
                serviceKey: decodeURIComponent(DataKoreaService.getServiceKey()),
                vehId: busVehId,
                resultType: "json"
            }
        });
    }
}