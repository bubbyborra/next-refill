// The call's state for the call screen and the phone page (no secrets in it).
import { getState } from "@/lib/store";
import { totals } from "@/lib/tools";


export async function GET(req: Request) {
  const sid = new URL(req.url).searchParams.get("sid") || "";
  const s = await getState(sid);
  if (!s) return Response.json({ error: "not found" }, { status: 404 });
  const { agentId: _agentId, ...pub } = s;
  void _agentId;
  return Response.json({ ...pub, totals: totals(s) }, { headers: { "Cache-Control": "no-store" } });
}
