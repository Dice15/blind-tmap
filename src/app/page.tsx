import styles from "@/app/page.module.css";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import Link from "next/link";
import AuthButton from "./_components/AuthButton";
import Image from "next/image";


export default async function AppRoot() {
  // Const
  const isAuth = (await getServerSession(authOptions)) !== null;

  // Render
  return (
    <div className={styles.wrapper}>
      <div className={styles.title}>
        Blind T-Map
      </div>
      <div style={{ position: 'relative', width: "35vw", height: "35vw", marginBottom: "4vw" }}>
        <Image src="/images/logo.png" sizes={"30vw"} alt="logo" fill priority />
      </div>
      <div className={styles.start}>
        {isAuth &&
          <Link href={"./chatbot"} className={styles.linkOps}>
            <button className={styles.btnOps}>시작하기</button>
          </Link>
        }
        <AuthButton
          isAuth={isAuth}
          authButtons={{
            signInButton: <button className={styles.btnOps}>로그인</button>,
            signOutButton: <button className={styles.btnOps}>로그아웃</button>
          }}
        />
      </div>
    </div>
  )
}