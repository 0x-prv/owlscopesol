import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getTokenIntelligence,
  TokenIntelligenceDatabaseError,
  TokenNotFoundError,
} from "@/services/token-intelligence-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mintAddressSchema = z
  .string()
  .trim()
  .min(32, "Mint address is too short.")
  .max(44, "Mint address is too long.")
  .regex(
    /^[1-9A-HJ-NP-Za-km-z]+$/,
    "Mint address is not valid Base58.",
  );

type RouteContext = {
  params: Promise<{
    mint: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { mint } = await context.params;

    const validation = mintAddressSchema.safeParse(mint);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_MINT_ADDRESS",
            message:
              validation.error.issues[0]?.message ??
              "Invalid Solana mint address.",
          },
        },
        {
          status: 400,
        },
      );
    }

    const intelligence = await getTokenIntelligence(
      validation.data,
    );

    return NextResponse.json(
      {
        success: true,
        data: intelligence,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof TokenNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "TOKEN_NOT_FOUND",
            message:
              "No analyzed token was found for this mint address.",
          },
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof TokenIntelligenceDatabaseError) {
      console.error("[token-api] Database request failed:", {
        message: error.message,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message:
              "Token intelligence is temporarily unavailable.",
          },
        },
        {
          status: 500,
        },
      );
    }

    console.error("[token-api] Unexpected request failure:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected server error occurred.",
        },
      },
      {
        status: 500,
      },
    );
  }
}