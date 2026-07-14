import { NextResponse } from "next/server";

// Quantity and state changes must use the explicit domain-mutation endpoints.
// Keeping this legacy URL read-only prevents a client from silently overwriting a balance.
export async function PATCH() {
  return NextResponse.json({ message: "Direct inventory updates are disabled. Use an audited inventory mutation endpoint." }, { status: 405 });
}
