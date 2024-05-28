import { MongoClient } from 'mongodb';
declare global {
    namespace globalThis {
        var _mongo: MongoClient | undefined;
        var _mongoUri: string | undefined;
    }
}