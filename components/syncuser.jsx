"use client";

import { useStoreUser } from "@/hooks/use-store-user";

export default function SyncUser() {
  useStoreUser();
  return null;
}
