import { prisma, parseProductCsv, ImportStatus, type Prisma } from '@commercepilot/database';

export interface CatalogImportJobData {
  importId: string;
  workspaceId: string;
  fileName: string;
  csvContent: string;
  defaultCurrency?: string;
  userId?: string;
}

export interface CatalogImportResult {
  importId: string;
  importedRows: number;
  failedRows: number;
  totalRows: number;
}

export async function processCatalogImport(
  data: CatalogImportJobData,
): Promise<CatalogImportResult> {
  const { importId, workspaceId, csvContent, defaultCurrency } = data;

  await prisma.catalogImport.update({
    where: { id: importId },
    data: { status: ImportStatus.PROCESSING },
  });

  try {
    const parsed = parseProductCsv(csvContent, defaultCurrency || 'USD');
    let importedRows = 0;

    for (const row of parsed.validRows) {
      if (row.sku) {
        const existing = await prisma.product.findFirst({
          where: { workspaceId, sku: row.sku },
        });

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              title: row.title,
              description: row.description ?? existing.description,
              priceCents: row.priceCents,
              currency: row.currency,
              inventoryCount: row.inventoryCount,
              url: row.url ?? existing.url,
              images: row.images.length > 0 ? row.images : existing.images,
              tags: row.tags.length > 0 ? row.tags : existing.tags,
              freshnessCheckedAt: new Date(),
            },
          });
          importedRows++;
          continue;
        }
      }

      await prisma.product.create({
        data: {
          workspaceId,
          sku: row.sku ?? null,
          title: row.title,
          description: row.description ?? null,
          priceCents: row.priceCents,
          currency: row.currency,
          inventoryCount: row.inventoryCount,
          url: row.url ?? null,
          images: row.images,
          tags: row.tags,
          source: 'CSV_IMPORT',
          freshnessCheckedAt: new Date(),
        },
      });
      importedRows++;
    }

    await prisma.catalogImport.update({
      where: { id: importId },
      data: {
        status: ImportStatus.COMPLETED,
        totalRows: parsed.totalRows,
        importedRows,
        failedRows: parsed.errors.length,
        errors: parsed.errors as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      importId,
      importedRows,
      failedRows: parsed.errors.length,
      totalRows: parsed.totalRows,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown import error';
    await prisma.catalogImport.update({
      where: { id: importId },
      data: {
        status: ImportStatus.FAILED,
        errors: [{ rowNumber: 0, errors: [errorMsg] }] as unknown as Prisma.InputJsonValue,
      },
    });
    throw err;
  }
}
