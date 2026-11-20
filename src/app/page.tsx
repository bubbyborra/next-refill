import { CallScreen } from "@/components/CallScreen";
import { Sections, SiteFooter } from "@/components/Landing";

export default function Home() {
  return (
    <CallScreen footer={<SiteFooter />}>
      <Sections />
    </CallScreen>
  );
}
