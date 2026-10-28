import { connection } from "next/server";
import { fetchGe6Balance } from "@/lib/chain";

export async function GET(_req: Request, ctx: RouteContext<"/api/balance/[address]">) {
  await connection();
  const { address } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: "รูปแบบที่อยู่กระเป๋าไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const balance = await fetchGe6Balance(address);
    return Response.json(
      { address: address.toLowerCase(), balance, at: Date.now() },
      {
        headers: {
          // Only fetched when someone opens a wallet row; a minute of sharing per wallet is plenty.
          "Cache-Control": "public, max-age=30",
          "Vercel-CDN-Cache-Control": "max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("[ge6] /api/balance failed:", err);
    return Response.json(
      { error: "ไม่สามารถดึงยอดคงเหลือได้ในขณะนี้" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
