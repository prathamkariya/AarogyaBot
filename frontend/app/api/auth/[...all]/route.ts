// Auth is handled client-side. This route is a no-op stub.
import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({ ok: true })
}
export function POST() {
  return NextResponse.json({ ok: true })
}
