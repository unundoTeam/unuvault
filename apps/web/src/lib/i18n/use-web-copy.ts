"use client";

import { useEffect, useState } from "react";
import { getWebCopy } from "./web-copy";

export function useWebCopy() {
  const [copy, setCopy] = useState(() => getWebCopy("en"));

  useEffect(() => {
    setCopy(getWebCopy());
  }, []);

  return copy;
}
