import { NextResponse } from "next/server";

export function GET() {
  const enabled = process.env.GOOGLE_MAPS_BROWSER_ENABLED === "true";
  const key = process.env.GOOGLE_MAPS_BROWSER_KEY;
  if (!enabled || !key) {
    return NextResponse.json({ enabled: false }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return NextResponse.json({ enabled: true, browserKey: key }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
