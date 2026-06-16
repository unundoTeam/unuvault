"use client";

import { useWebCopy } from "../lib/i18n/use-web-copy";

export default function HomePage() {
  const copy = useWebCopy().home;

  return (
    <main>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <a href="/register">{copy.registerLink}</a>
    </main>
  );
}
