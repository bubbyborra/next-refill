import { Suspense } from "react";
import { PhoneList } from "@/components/PhoneList";

async function List({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  return <PhoneList sid={sid} />;
}

export default function PhonePage(props: PageProps<"/p/[sid]">) {
  return (
    <Suspense fallback={<p className="nr-list nr-list__sub">Loading the list…</p>}>
      <List params={props.params} />
    </Suspense>
  );
}
