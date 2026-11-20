// One function for every API route, so a call's in-memory state is shared by the agent's
// model requests and the screens' polling even without Redis (Upstash is used when set).
import * as ics from "@/server/ics";
import * as llm from "@/server/llm";
import * as session from "@/server/session";
import * as state from "@/server/state";
import * as strip from "@/server/strip";
import * as typed from "@/server/type";
import * as voice from "@/server/voice";

export const maxDuration = 60;

type Ctx = RouteContext<"/api/[...op]">;

async function route(req: Request, ctx: Ctx, method: "GET" | "POST" | "DELETE"): Promise<Response> {
  const { op } = await ctx.params;
  const [head, arg] = op;
  if (method === "POST") {
    if (head === "llm") return llm.POST(req);
    if (head === "session") return session.POST(req);
    if (head === "agent") return session.START_AGENT(req);
    if (head === "strip") return strip.POST(req);
    if (head === "type") return typed.POST(req);
  }
  if (method === "GET") {
    if (head === "state") return state.GET(req);
    if (head === "ics" && arg) return ics.GET(req, arg);
    if (head === "voice" && arg) return voice.GET(req, arg);
  }
  if (method === "DELETE" && head === "session") return session.DELETE(req);
  return new Response("not found", { status: 404 });
}

export const GET = (req: Request, ctx: Ctx) => route(req, ctx, "GET");
export const POST = (req: Request, ctx: Ctx) => route(req, ctx, "POST");
export const DELETE = (req: Request, ctx: Ctx) => route(req, ctx, "DELETE");
