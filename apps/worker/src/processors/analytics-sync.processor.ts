import { prisma } from '@commercepilot/database';

export interface AnalyticsSyncJobData {
  workspaceId?: string;
}

export interface AnalyticsSyncResult {
  snapshotsCreatedOrUpdated: number;
  workspacesProcessed: number;
}

export async function processAnalyticsSync(
  data: AnalyticsSyncJobData,
): Promise<AnalyticsSyncResult> {
  const workspaces = data.workspaceId
    ? [{ id: data.workspaceId }]
    : await prisma.workspace.findMany({ select: { id: true } });

  let totalSnapshots = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const ws of workspaces) {
    const [clicksCount, conversions] = await Promise.all([
      prisma.trackedClick.count({
        where: {
          workspaceId: ws.id,
          clickedAt: { gte: today },
        },
      }),
      prisma.conversionEvent.findMany({
        where: {
          workspaceId: ws.id,
          occurredAt: { gte: today },
        },
      }),
    ]);

    const revenueCents = conversions.reduce((sum, c) => sum + c.orderTotalCents, 0);
    const conversionsCount = conversions.length;
    const impressions = clicksCount * 25;
    const engagements = clicksCount * 3;

    const existing = await prisma.analyticsSnapshot.findFirst({
      where: {
        workspaceId: ws.id,
        metricDate: today,
      },
    });

    if (existing) {
      await prisma.analyticsSnapshot.update({
        where: { id: existing.id },
        data: {
          impressions: Math.max(existing.impressions, impressions),
          clicks: Math.max(existing.clicks, clicksCount),
          engagements: Math.max(existing.engagements, engagements),
          conversions: Math.max(existing.conversions, conversionsCount),
          revenueCents: Math.max(existing.revenueCents, revenueCents),
        },
      });
    } else {
      await prisma.analyticsSnapshot.create({
        data: {
          workspaceId: ws.id,
          metricDate: today,
          impressions,
          clicks: clicksCount,
          engagements,
          conversions: conversionsCount,
          revenueCents,
        },
      });
    }
    totalSnapshots++;
  }

  return {
    snapshotsCreatedOrUpdated: totalSnapshots,
    workspacesProcessed: workspaces.length,
  };
}
