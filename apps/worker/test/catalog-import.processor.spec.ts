import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processCatalogImport } from '../src/processors/catalog-import.processor';
import { prisma, ImportStatus } from '@commercepilot/database';

vi.mock('@commercepilot/database', async () => {
  const actual = await vi.importActual<any>('@commercepilot/database');
  return {
    ...actual,
    prisma: {
      catalogImport: {
        update: vi.fn().mockResolvedValue({}),
      },
      product: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: 'prod-new' }),
        update: vi.fn().mockResolvedValue({ id: 'prod-updated' }),
      },
    },
  };
});

describe('processCatalogImport', () => {
  const importId = '60b8d29f1c9d440000a11111';
  const workspaceId = '60b8d29f1c9d440000a22222';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes valid CSV rows, creates products, and marks import as COMPLETED', async () => {
    const csvContent =
      'sku,title,price,inventory\n' +
      'SKU-100,Organic Tee,25.00,10\n' +
      'SKU-101,Linen Cap,15.50,5\n';

    (prisma.product.findFirst as any).mockResolvedValue(null);

    const result = await processCatalogImport({
      importId,
      workspaceId,
      fileName: 'inventory.csv',
      csvContent,
    });

    expect(result.importedRows).toBe(2);
    expect(result.failedRows).toBe(0);
    expect(prisma.catalogImport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: importId },
        data: expect.objectContaining({
          status: ImportStatus.COMPLETED,
          importedRows: 2,
        }),
      }),
    );
  });

  it('records failed rows when malformed entries exist', async () => {
    const csvContent =
      'sku,title,price,inventory\n' + ',Missing Title,20.00,5\n' + 'SKU-200,,20.00,5\n'; // Missing title

    (prisma.product.findFirst as any).mockResolvedValue(null);

    const result = await processCatalogImport({
      importId,
      workspaceId,
      fileName: 'bad_inventory.csv',
      csvContent,
    });

    expect(result.importedRows).toBe(1);
    expect(result.failedRows).toBe(1);
  });
});
