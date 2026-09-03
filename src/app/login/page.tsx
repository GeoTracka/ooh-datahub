import type { Metadata } from "next";

import { LoginForm } from "@/features/chat/LoginForm";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Sign in · OOH Datahub",
  description: "Sign in to your campaign planning workspace.",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <LoginForm />
      <p className={styles.note}>Private workspace · Access is managed by your team</p>
    </main>
  );
}

