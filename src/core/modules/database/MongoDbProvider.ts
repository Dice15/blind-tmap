import { MongoClient, Db } from "mongodb";

/**
 * MongoDbProvider는 MongoDB 데이터베이스 연결을 관리하는 싱글톤 클래스입니다.
 * 이 클래스는 애플리케이션 전역에서 단일 MongoDB 클라이언트 인스턴스를 관리하여
 * 효율적인 연결 및 리소스 사용을 보장합니다.
 */
export default class MongoDbProvider {
    private static client: MongoClient | undefined = undefined;
    private static dbInstance: Db | undefined = undefined;
    private static uri: string = "";

    private constructor() { }

    public static async connectDb(uri: string): Promise<MongoClient> {
        if (MongoDbProvider.uri === uri && MongoDbProvider.client) {
            return MongoDbProvider.client;
        } else {
            MongoDbProvider.uri = uri;
        }

        if (!MongoDbProvider.uri) {
            throw new Error("MongoDB URI is not defined.");
        }

        MongoDbProvider.client = new MongoClient(MongoDbProvider.uri, {
            serverSelectionTimeoutMS: 30000, // 타임아웃 설정
        });

        try {
            await MongoDbProvider.client.connect();
        } catch (err) {
            console.error("MongoDB connection failed:", err);
            MongoDbProvider.client = undefined;
            throw err;
        }

        return MongoDbProvider.client;
    }

    public static async disconnectDb(): Promise<void> {
        if (MongoDbProvider.client) {
            await MongoDbProvider.client.close();
            MongoDbProvider.client = undefined;
            MongoDbProvider.dbInstance = undefined;
        }
    }

    public static isConnected(): boolean {
        return MongoDbProvider.client !== undefined;
    }

    public static async getDb(): Promise<Db> {
        if (!MongoDbProvider.client) {
            throw new Error("Connect Db first.");
        }

        if (!MongoDbProvider.dbInstance && MongoDbProvider.client) {
            MongoDbProvider.dbInstance = MongoDbProvider.client.db();
        }

        if (!MongoDbProvider.dbInstance) {
            throw new Error("Failed to get MongoDB instance.");
        }

        return MongoDbProvider.dbInstance;
    }
}