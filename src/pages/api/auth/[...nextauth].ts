import NextAuth, { AuthOptions, Session, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import GithubProvider from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { ObjectId } from "mongodb";


declare module "next-auth/jwt" {
    interface JWT {
        user: User;
    }
}


declare module "next-auth" {
    interface Session {
        user: User & { id: string };
    }
}


export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Guest User',
            credentials: {},
            authorize: async () => {
                // 새로운 게스트 사용자 ID 생성
                const guestId = new ObjectId().toString();
                return {
                    id: guestId,
                    name: 'Guest User',
                    email: `guest_${guestId}@guest.com`,
                };
            },
        }),
        GithubProvider({
            clientId: process.env.BLINDROUTE_GITHUB_LOCAL_ID,
            clientSecret: process.env.BLINDROUTE_GITHUB_LOCAL_SECRET,
        }),
        Google({
            clientId: process.env.BLINDROUTE_GOOGLE_LOCAL_ID,
            clientSecret: process.env.BLINDROUTE_GOOGLE_LOCAL_SECRET,
        }),
    ],

    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60 // 30일
    },

    callbacks: {
        // JWT 토큰 생성 시 호출 (사용자 정보를 JWT 토큰에 포함)
        jwt: async ({ token, user }: { token: JWT, user?: User }) => {
            if (user) {
                token.user = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                };
            }
            return token;
        },
        // 세션 조회 시 호출 (JWT 토큰의 사용자 정보를 세션에 포함)
        session: async ({ session, token }: { session: Session, token: JWT }) => {
            session.user = token.user;
            return session;
        },
    },

    secret: process.env.BLINDROUTE_NEXTAUTH_SECRET,
}

export default NextAuth(authOptions);