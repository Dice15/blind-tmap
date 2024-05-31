import { IForwarding } from "./IForwarding";

export interface IRouting {
    fare: string;
    time: string;
    forwarding: IForwarding[];
};