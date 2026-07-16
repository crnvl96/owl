import type { ComponentProps } from "react";

import styles from "./Button.module.css";

type ButtonVariant = "default" | "ghost";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
}

export function Button({ variant = "default", className, ...props }: ButtonProps) {
  const variantClass = variant === "ghost" ? styles.ghost : styles.default;
  const cls = [styles.button, variantClass, className].filter(Boolean).join(" ");
  return <button className={cls} {...props} />;
}
