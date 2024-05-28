import styles from "@/app/chatbot/page.module.css";
import ChatAdot from "./_components/ChatAdot";

export default async function ChatBotPage() {
    return (
        <div className={styles.wrapper}>
            <ChatAdot />
        </div>
    )
}