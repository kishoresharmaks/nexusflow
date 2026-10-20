import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductsController } from '../src/products/products.controller';
import type { ProductsService } from '../src/products/products.service';
import type { Request } from 'express';

describe('ProductsController', () => {
  let controller: ProductsController;
  let mockService: Partial<ProductsService>;

  const workspaceId = '60b8d29f1c9d440000a11111';
  const productId = '60b8d29f1c9d440000a22222';
  const user = {
    id: '60b8d29f1c9d440000a33333',
    email: 'merchant@example.com',
    name: 'Merchant User',
  };
  const mockReq = {
    headers: {},
    ip: '127.0.0.1',
  } as Request;

  beforeEach(() => {
    mockService = {
      createProduct: vi.fn(),
      findProducts: vi.fn(),
      getProductById: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn(),
      importCsv: vi.fn(),
      getCatalogImports: vi.fn(),
      getCatalogImportById: vi.fn(),
      refreshProductFreshness: vi.fn(),
    };

    controller = new ProductsController(mockService as ProductsService);
  });

  it('delegates product creation to service', async () => {
    const dto = { title: 'Test Product', priceCents: 1500 };
    vi.spyOn(mockService, 'createProduct').mockResolvedValue({
      id: productId,
      workspaceId,
      title: 'Test Product',
      priceCents: 1500,
      isStale: false,
    } as any);

    const res = await controller.create(workspaceId, dto, user, mockReq);
    expect(res.id).toBe(productId);
    expect(mockService.createProduct).toHaveBeenCalledWith(workspaceId, dto, user.id, '127.0.0.1');
  });

  it('delegates product query with pagination to service', async () => {
    const query = { page: 2, limit: 10, search: 'shirt' };
    vi.spyOn(mockService, 'findProducts').mockResolvedValue({
      items: [],
      meta: { total: 0, page: 2, limit: 10, totalPages: 0 },
    });

    const res = await controller.list(workspaceId, query as any);
    expect(res.meta.page).toBe(2);
    expect(mockService.findProducts).toHaveBeenCalledWith(workspaceId, query);
  });

  it('delegates CSV import to service', async () => {
    const dto = { fileName: 'test.csv', csvContent: 'sku,title,price\nS1,T1,10' };
    vi.spyOn(mockService, 'importCsv').mockResolvedValue({
      id: 'imp-1',
      workspaceId,
      status: 'COMPLETED',
      totalRows: 1,
      importedRows: 1,
      failedRows: 0,
    } as any);

    const res = await controller.importCsv(workspaceId, dto, user, mockReq);
    expect(res.status).toBe('COMPLETED');
    expect(mockService.importCsv).toHaveBeenCalledWith(workspaceId, dto, user.id, '127.0.0.1');
  });

  it('delegates single product fetch to service', async () => {
    vi.spyOn(mockService, 'getProductById').mockResolvedValue({
      id: productId,
      workspaceId,
      title: 'Item',
      isStale: false,
    } as any);

    const res = await controller.getOne(workspaceId, productId);
    expect(res.id).toBe(productId);
    expect(mockService.getProductById).toHaveBeenCalledWith(workspaceId, productId);
  });

  it('delegates product deletion to service', async () => {
    vi.spyOn(mockService, 'deleteProduct').mockResolvedValue({ success: true, id: productId });

    const res = await controller.delete(workspaceId, productId, user, mockReq);
    expect(res.success).toBe(true);
    expect(mockService.deleteProduct).toHaveBeenCalledWith(
      workspaceId,
      productId,
      user.id,
      '127.0.0.1',
    );
  });

  it('delegates product freshness refresh to service', async () => {
    vi.spyOn(mockService, 'refreshProductFreshness').mockResolvedValue({
      id: productId,
      workspaceId,
      title: 'Item',
      isStale: false,
    } as any);

    const res = await controller.refreshFreshness(workspaceId, productId, user, mockReq);
    expect(res.isStale).toBe(false);
    expect(mockService.refreshProductFreshness).toHaveBeenCalledWith(
      workspaceId,
      productId,
      user.id,
      '127.0.0.1',
    );
  });
});
