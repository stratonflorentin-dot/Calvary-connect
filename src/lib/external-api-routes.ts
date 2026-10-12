import { NextResponse } from "next/server";
import { apiError, apiResponseStatus, type ApiResponse } from "@/lib/external-apis";

export const EXTERNAL_API_ROLES = ["CEO", "ADMIN", "OPERATOR", "DISPATCHER", "ACCOUNTANT"];

export function externalApiJson<T>(response: ApiResponse<T>) {
  return NextResponse.json(response, { status: apiResponseStatus(response) });
}

export function invalidExternalRequest(source: string, message: string) {
  return externalApiJson(apiError(source, "INVALID_ARGUMENT", message));
}
