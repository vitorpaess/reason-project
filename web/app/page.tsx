import { redirect } from "next/navigation";
import { PAIRS } from "@/lib/config";

export default function Home() {
  redirect(`/pair/${PAIRS[0].slug}`);
}
