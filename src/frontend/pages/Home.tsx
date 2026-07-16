import { ReviewUI } from "@/components/review/ReviewUI";

import styles from "./Home.module.css";

export function HomePage() {
  return (
    <div className={styles.page}>
      <ReviewUI />
    </div>
  );
}
