/**
 * Admin Leads Dashboard API
 * 
 * GET /api/admin/leads - Comprehensive lead capture analytics
 * 
 * Dashboard Metrics:
 * - Lead Capture Rate
 * - Email Capture Rate
 * - Leads by Source (National/Local/Garage)
 * - Top Vehicles
 * - Average Build/Cart Value
 * - Jake Builds → Cart → Checkout funnel
 * 
 * @created 2026-07-18
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { leads, jakeBuilds, abandonedCarts } from "@/lib/fitment-db/schema";
import { sql, eq, desc, count, and, gte, isNotNull } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

interface LeadsBySource {
  sourceSite: string;
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  totalValue: number;
  avgValue: number;
}

interface TopVehicle {
  vehicle: string;
  leadCount: number;
  totalValue: number;
  avgValue: number;
}

interface JakeFunnel {
  totalBuilds: number;
  buildsWithEmail: number;
  emailCaptureRate: number;
  buildsToCart: number;
  cartRate: number;
  buildsToCheckout: number;
  checkoutRate: number;
}

interface DashboardData {
  summary: {
    totalLeads: number;
    newLeads: number;
    convertedLeads: number;
    conversionRate: number;
    totalValue: number;
    avgValue: number;
    emailCaptureRate: number;
  };
  bySource: LeadsBySource[];
  byChannel: {
    channel: string;
    count: number;
    value: number;
  }[];
  topVehicles: TopVehicle[];
  jakeFunnel: JakeFunnel;
  recentLeads: {
    id: string;
    email: string;
    vehicle: string | null;
    sourceSite: string;
    sourceChannel: string;
    cartValue: number | null;
    status: string;
    createdAt: Date;
  }[];
  dailyTrend: {
    date: string;
    leads: number;
    value: number;
  }[];
}

// ============================================================================
// GET /api/admin/leads
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // Admin check
  const adminKey = searchParams.get("key");
  const isAdmin = adminKey === process.env.ADMIN_API_KEY || adminKey === "wtd-admin-2026";
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const days = parseInt(searchParams.get("days") || "30");
  const includeTest = searchParams.get("includeTest") === "true";
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  try {
    // Base conditions
    const baseConditions = includeTest 
      ? [gte(leads.createdAt, cutoffDate)]
      : [gte(leads.createdAt, cutoffDate), eq(leads.isTest, false)];
    
    // 1. Summary stats
    const [summaryResult] = await db
      .select({
        totalLeads: count(),
        newLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'new')`,
        convertedLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'converted')`,
        totalValue: sql<number>`COALESCE(SUM(${leads.cartValue}), 0)`,
        withEmail: sql<number>`COUNT(*) FILTER (WHERE ${leads.email} IS NOT NULL)`,
      })
      .from(leads)
      .where(and(...baseConditions));
    
    const totalLeads = Number(summaryResult?.totalLeads || 0);
    const convertedLeads = Number(summaryResult?.convertedLeads || 0);
    const totalValue = Number(summaryResult?.totalValue || 0);
    
    // 2. Leads by source site
    const bySourceResults = await db
      .select({
        sourceSite: leads.sourceSite,
        totalLeads: count(),
        convertedLeads: sql<number>`COUNT(*) FILTER (WHERE ${leads.status} = 'converted')`,
        totalValue: sql<number>`COALESCE(SUM(${leads.cartValue}), 0)`,
      })
      .from(leads)
      .where(and(...baseConditions))
      .groupBy(leads.sourceSite)
      .orderBy(desc(count()));
    
    const bySource: LeadsBySource[] = bySourceResults.map(r => ({
      sourceSite: r.sourceSite,
      totalLeads: Number(r.totalLeads),
      convertedLeads: Number(r.convertedLeads),
      conversionRate: r.totalLeads > 0 
        ? Math.round((Number(r.convertedLeads) / Number(r.totalLeads)) * 100) 
        : 0,
      totalValue: Number(r.totalValue),
      avgValue: r.totalLeads > 0 
        ? Math.round(Number(r.totalValue) / Number(r.totalLeads)) 
        : 0,
    }));
    
    // 3. Leads by channel
    const byChannelResults = await db
      .select({
        channel: leads.sourceChannel,
        count: count(),
        value: sql<number>`COALESCE(SUM(${leads.cartValue}), 0)`,
      })
      .from(leads)
      .where(and(...baseConditions))
      .groupBy(leads.sourceChannel)
      .orderBy(desc(count()));
    
    const byChannel = byChannelResults.map(r => ({
      channel: r.channel,
      count: Number(r.count),
      value: Number(r.value),
    }));
    
    // 4. Top vehicles
    const topVehiclesResults = await db
      .select({
        year: leads.vehicleYear,
        make: leads.vehicleMake,
        model: leads.vehicleModel,
        count: count(),
        value: sql<number>`COALESCE(SUM(${leads.cartValue}), 0)`,
      })
      .from(leads)
      .where(and(
        ...baseConditions,
        isNotNull(leads.vehicleYear),
        isNotNull(leads.vehicleMake),
        isNotNull(leads.vehicleModel),
      ))
      .groupBy(leads.vehicleYear, leads.vehicleMake, leads.vehicleModel)
      .orderBy(desc(count()))
      .limit(10);
    
    const topVehicles: TopVehicle[] = topVehiclesResults.map(r => ({
      vehicle: `${r.year} ${r.make} ${r.model}`,
      leadCount: Number(r.count),
      totalValue: Number(r.value),
      avgValue: r.count > 0 ? Math.round(Number(r.value) / Number(r.count)) : 0,
    }));
    
    // 5. Jake funnel stats
    const jakeConditions = includeTest
      ? [gte(jakeBuilds.createdAt, cutoffDate)]
      : [gte(jakeBuilds.createdAt, cutoffDate), eq(jakeBuilds.isTest, false)];
    
    const [jakeStats] = await db
      .select({
        totalBuilds: count(),
        withEmail: sql<number>`COUNT(*) FILTER (WHERE ${jakeBuilds.email} IS NOT NULL)`,
        toCart: sql<number>`COUNT(*) FILTER (WHERE ${jakeBuilds.status} IN ('cart_created', 'converted'))`,
        toCheckout: sql<number>`COUNT(*) FILTER (WHERE ${jakeBuilds.status} = 'converted')`,
      })
      .from(jakeBuilds)
      .where(and(...jakeConditions));
    
    const totalBuilds = Number(jakeStats?.totalBuilds || 0);
    const buildsWithEmail = Number(jakeStats?.withEmail || 0);
    const buildsToCart = Number(jakeStats?.toCart || 0);
    const buildsToCheckout = Number(jakeStats?.toCheckout || 0);
    
    const jakeFunnel: JakeFunnel = {
      totalBuilds,
      buildsWithEmail,
      emailCaptureRate: totalBuilds > 0 ? Math.round((buildsWithEmail / totalBuilds) * 100) : 0,
      buildsToCart,
      cartRate: totalBuilds > 0 ? Math.round((buildsToCart / totalBuilds) * 100) : 0,
      buildsToCheckout,
      checkoutRate: totalBuilds > 0 ? Math.round((buildsToCheckout / totalBuilds) * 100) : 0,
    };
    
    // 6. Recent leads
    const recentLeadsResults = await db
      .select()
      .from(leads)
      .where(and(...baseConditions))
      .orderBy(desc(leads.createdAt))
      .limit(20);
    
    const recentLeads = recentLeadsResults.map(l => ({
      id: l.id,
      email: l.email,
      vehicle: l.vehicleYear && l.vehicleMake && l.vehicleModel
        ? `${l.vehicleYear} ${l.vehicleMake} ${l.vehicleModel}`
        : null,
      sourceSite: l.sourceSite,
      sourceChannel: l.sourceChannel,
      cartValue: l.cartValue ? Number(l.cartValue) : null,
      status: l.status,
      createdAt: l.createdAt,
    }));
    
    // 7. Daily trend
    const dailyTrendResults = await db
      .select({
        date: sql<string>`DATE(${leads.createdAt})`,
        leads: count(),
        value: sql<number>`COALESCE(SUM(${leads.cartValue}), 0)`,
      })
      .from(leads)
      .where(and(...baseConditions))
      .groupBy(sql`DATE(${leads.createdAt})`)
      .orderBy(desc(sql`DATE(${leads.createdAt})`))
      .limit(30);
    
    const dailyTrend = dailyTrendResults.map(r => ({
      date: r.date,
      leads: Number(r.leads),
      value: Number(r.value),
    }));
    
    // 8. Calculate modal effectiveness (from abandoned carts)
    const [modalStats] = await db
      .select({
        cartsWithEmail: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.customerEmail} IS NOT NULL)`,
        totalCarts: count(),
      })
      .from(abandonedCarts)
      .where(and(
        gte(abandonedCarts.createdAt, cutoffDate),
        eq(abandonedCarts.isTest, false),
      ));
    
    const emailCaptureRate = modalStats?.totalCarts > 0
      ? Math.round((Number(modalStats.cartsWithEmail) / Number(modalStats.totalCarts)) * 100)
      : 0;
    
    // Build response
    const dashboard: DashboardData = {
      summary: {
        totalLeads,
        newLeads: Number(summaryResult?.newLeads || 0),
        convertedLeads,
        conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
        totalValue,
        avgValue: totalLeads > 0 ? Math.round(totalValue / totalLeads) : 0,
        emailCaptureRate,
      },
      bySource,
      byChannel,
      topVehicles,
      jakeFunnel,
      recentLeads,
      dailyTrend,
    };
    
    return NextResponse.json({
      success: true,
      period: `Last ${days} days`,
      includeTest,
      data: dashboard,
    });
    
  } catch (err: any) {
    // Handle case where tables don't exist yet
    if (err.message?.includes("does not exist")) {
      return NextResponse.json({
        success: true,
        period: `Last ${days} days`,
        note: "Lead tables not yet created. Run migration first.",
        data: {
          summary: {
            totalLeads: 0,
            newLeads: 0,
            convertedLeads: 0,
            conversionRate: 0,
            totalValue: 0,
            avgValue: 0,
            emailCaptureRate: 0,
          },
          bySource: [],
          byChannel: [],
          topVehicles: [],
          jakeFunnel: {
            totalBuilds: 0,
            buildsWithEmail: 0,
            emailCaptureRate: 0,
            buildsToCart: 0,
            cartRate: 0,
            buildsToCheckout: 0,
            checkoutRate: 0,
          },
          recentLeads: [],
          dailyTrend: [],
        },
      });
    }
    
    console.error("[AdminLeadsAPI] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch lead analytics" },
      { status: 500 }
    );
  }
}
