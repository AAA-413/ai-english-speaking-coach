import { PracticeShell } from "@/components/PracticeShell";
import { scenarios } from "@/shared/scenarios";

export default function Home() {
  return <PracticeShell appName="AI English Speaking Coach" scenarios={scenarios} />;
}
