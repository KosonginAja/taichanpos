import { NextResponse } from "next/server";
import { db } from "@/db";
import { businessSettings } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    let settings = await db.query.businessSettings.findFirst();
    
    // If no settings exist yet, create default
    if (!settings) {
      const [newSettings] = await db.insert(businessSettings).values({
        businessName: "My Business",
      }).returning();
      settings = newSettings;
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("GET settings error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 });
    }

    const body = await req.json();
    
    // Parse rounding settings
    if (body.roundingEnabled !== undefined) body.roundingEnabled = !!body.roundingEnabled;
    if (body.roundingNearest !== undefined) body.roundingNearest = parseFloat(body.roundingNearest).toString();
    
    const settings = await db.query.businessSettings.findFirst();
    let updated;

    if (!settings) {
      // Insert
      const [newSettings] = await db.insert(businessSettings).values({
        ...body,
        updatedAt: new Date()
      }).returning();
      updated = newSettings;
    } else {
      // Update
      const [updatedSettings] = await db
        .update(businessSettings)
        .set({
          ...body,
          updatedAt: new Date()
        })
        .returning();
      updated = updatedSettings;
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("POST settings error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
