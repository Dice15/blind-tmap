import styles from "@/app/passenger/reserve-bus/page.module.css";
import PathFinder from "./_components/PathFinder";

export default async function ChatBotPage() {
    return (
        <div className={styles.wrapper}>
            <PathFinder />
        </div>
    )
}