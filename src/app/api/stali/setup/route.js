import { NextResponse } from "next/server";
import { runStaliSetup } from "@/lib/staliSetup";
import { resolveLocalEndpoint } from "@/lib/staliOnly";

export const dynamic = "force-dynamic";

/** POST /api/stali/setup — one-click Stali preset (same logic as dashboard). */
export async function POST(request) {
  try {
    const body = await request.json();
    const { baseUrl, apiKey, models } = body || {};

    const result = await runStaliSetup({ baseUrl, apiKey, models });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, liveModels: result.liveModels },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Stali setup completed successfully.",
      models: result.enabledModels,
      routerKey: result.routerApiKey,
      endpoint: resolveLocalEndpoint(request),
      ...result,
    });
  } catch (error) {
    console.log("Error running Stali setup:", error);
    return NextResponse.json(
      { error: error?.message || "Stali setup failed" },
      { status: 500 },
    );
  }
}
