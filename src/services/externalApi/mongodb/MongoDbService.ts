import MongoDbProvider from "@/core/modules/database/MongoDbProvider";
import { Db } from "mongodb";

export default class MongoDbService {
    private constructor() { }


    public static getDbURI(): string {
        return process.env.BLINDROUTE_MONGODB_URI;
    }


    public static async getDb(): Promise<Db> {
        return MongoDbProvider.connectDb(this.getDbURI()).then(() => MongoDbProvider.getDb());
    }
}