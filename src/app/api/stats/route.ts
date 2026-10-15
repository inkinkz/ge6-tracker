import { connection } from "next/server";
import { STATS_BROWSER_MAX_AGE_SEC, STATS_CDN_MAX_AGE_SEC, STATS_CDN_SWR_SEC } from "@/lib/config";
import { getStats } from "@/lib/tracker";

// A cold instance may need to load the full history before answering.
export const maxDuration = 60;

export async function GET() {
  await connection();
  try {
    const { json } = await getStats();
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Vercel's CDN shares one response among all viewers in a region, so client polling costs
        // CDN requests, not function invocations. The short browser max-age dedupes reloads/tabs.
        "Cache-Control": `public, max-age=${STATS_BROWSER_MAX_AGE_SEC}`,
        "Vercel-CDN-Cache-Control": `max-age=${STATS_CDN_MAX_AGE_SEC}, stale-while-revalidate=${STATS_CDN_SWR_SEC}`,
      },
    });
  } catch (err) {
    console.error("[ge6] /api/stats failed:", err);
    return Response.json(
      { error: "ไม่สามารถดึงข้อมูลจากบล็อกเชนได้ในขณะนี้" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
