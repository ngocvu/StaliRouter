import { NextResponse } from "next/server";
import { buildStaliProfile } from "@/lib/staliSetup";
import { isStaliOnlyMode } from "@/lib/staliOnly";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const profile = await buildStaliProfile(request);
    return NextResponse.json({
      staliOnlyMode: isStaliOnlyMode(),
      ...profile,
    });
  } catch (error) {
    console.log("Error building Stali profile:", error);
    return NextResponse.json(
      { error: "Failed to build Stali profile" },
      { status: 500 },
    );
  }
}
