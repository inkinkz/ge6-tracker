import { connection } from "next/server";
import { STATS_CDN_MAX_AGE_SEC, STATS_CDN_SWR_SEC } from "@/lib/config";
import { getWallet } from "@/lib/tracker";

export const maxDuration = 60;

export async function GET(_req: Request, ctx: RouteContext<"/api/wallet/[address]">) {
  await connection();
  const { address } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: "รูปแบบที่อยู่กระเป๋าไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const info = await getWallet(address);
    return Response.json(info, {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Vercel-CDN-Cache-Control": `max-age=${STATS_CDN_MAX_AGE_SEC}, stale-while-revalidate=${STATS_CDN_SWR_SEC}`,
      },
    });
  } catch (err) {
    console.error("[ge6] /api/wallet failed:", err);
    return Response.json(
      { error: "ไม่สามารถดึงข้อมูลจากบล็อกเชนได้ในขณะนี้" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
