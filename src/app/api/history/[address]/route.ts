import { getWalletHistory } from "@/lib/wallet-history";

export async function GET(_req: Request, ctx: RouteContext<"/api/history/[address]">) {
  const { address } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: "รูปแบบที่อยู่กระเป๋าไม่ถูกต้อง" }, { status: 400 });
  }
  // GE3–GE5 results are static (bundled data), so responses can be shared for a long time.
  return Response.json(getWalletHistory(address), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Vercel-CDN-Cache-Control": "max-age=86400, stale-while-revalidate=604800",
    },
  });
}
