import styles from "./BlankArea.module.css";

export function BlankArea() {
  return <div aria-hidden="true" className={styles.blank} />;
}
