import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { AuthService } from '../src/auth/auth.service';
import { WorkspacesService } from '../src/workspaces/workspaces.service';

describe('E2E Catalog and Cross-Tenant Isolation Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let workspacesService: WorkspacesService;
  let baseUrl: string;

  let tenant1Token: string;
  let tenant1WorkspaceId: string;
  let tenant1UserId: string;

  let tenant2Token: string;
  let tenant2WorkspaceId: string;
  let tenant2UserId: string;

  let createdProductId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'ready', 'api/v1/health', 'api/v1/ready'],
    });

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    workspacesService = app.get(WorkspacesService);

    // Setup Tenant 1
    const t1Email = `e2e_t1_${Date.now()}@example.test`;
    const t1Reg = await authService.register({
      email: t1Email,
      password: 'SecurePassword123!',
      name: 'Tenant 1 Admin',
    });
    tenant1UserId = t1Reg.user.id;
    tenant1Token = t1Reg.sessionToken;

    const t1Ws = await workspacesService.createWorkspace(tenant1UserId, {
      name: 'Tenant 1 Store',
      slug: `t1-store-${Date.now()}`,
    });
    tenant1WorkspaceId = t1Ws.workspace.id;

    // Setup Tenant 2
    const t2Email = `e2e_t2_${Date.now()}@example.test`;
    const t2Reg = await authService.register({
      email: t2Email,
      password: 'SecurePassword123!',
      name: 'Tenant 2 Admin',
    });
    tenant2UserId = t2Reg.user.id;
    tenant2Token = t2Reg.sessionToken;

    const t2Ws = await workspacesService.createWorkspace(tenant2UserId, {
      name: 'Tenant 2 Store',
      slug: `t2-store-${Date.now()}`,
    });
    tenant2WorkspaceId = t2Ws.workspace.id;
  });

  afterAll(async () => {
    // Cleanup created data
    try {
      if (tenant1WorkspaceId) {
        await prisma.product.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.catalogImport.deleteMany({ where: { workspaceId: tenant1WorkspaceId } });
        await prisma.workspace.delete({ where: { id: tenant1WorkspaceId } });
      }
      if (tenant2WorkspaceId) {
        await prisma.workspace.delete({ where: { id: tenant2WorkspaceId } });
      }
      if (tenant1UserId) {
        await prisma.user.delete({ where: { id: tenant1UserId } });
      }
      if (tenant2UserId) {
        await prisma.user.delete({ where: { id: tenant2UserId } });
      }
    } catch {
      // Ignore cleanup error
    }

    if (app) {
      await app.close();
    }
  });

  it('1. Creates a product via POST /workspaces/:workspaceId/products', async () => {
    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        sku: 'E2E-SHIRT-001',
        title: 'E2E Classic Silk Shirt',
        description: 'Luxurious silk shirt for testing',
        priceCents: 5900,
        currency: 'USD',
        inventoryCount: 25,
        tags: ['apparel', 'silk'],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe('E2E Classic Silk Shirt');
    expect(body.priceCents).toBe(5900);
    expect(body.isStale).toBe(false);

    createdProductId = body.id;
  });

  it('2. Lists products with search & pagination via GET /workspaces/:workspaceId/products', async () => {
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/products?search=silk&page=1&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${tenant1Token}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBe(1);
    expect(body.items[0].id).toBe(createdProductId);
    expect(body.meta.total).toBe(1);
  });

  it('3. Updates product details via PATCH /workspaces/:workspaceId/products/:productId', async () => {
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/products/${createdProductId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenant1Token}`,
        },
        body: JSON.stringify({
          priceCents: 6500,
          inventoryCount: 30,
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.priceCents).toBe(6500);
    expect(body.inventoryCount).toBe(30);
  });

  it('4. Imports CSV with valid and malformed rows via POST /workspaces/:workspaceId/products/import-csv', async () => {
    const csvContent =
      `sku,title,price,inventory,tags\r\n` +
      `CSV-E2E-1,Linen Blazer,120.00,5,"suits, linen"\r\n` +
      `CSV-E2E-2,,15.00,10,bad-row\r\n` +
      `CSV-E2E-3,Wool Scarf,-10.00,20,bad-price\r\n` +
      `CSV-E2E-4,Silk Pocket Square,15.50,50,accessories`;

    const res = await fetch(`${baseUrl}/workspaces/${tenant1WorkspaceId}/products/import-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        fileName: 'spring_collection.csv',
        csvContent,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('COMPLETED');
    expect(body.totalRows).toBe(4);
    expect(body.importedRows).toBe(2);
    expect(body.failedRows).toBe(2);
    expect(Array.isArray(body.errors)).toBe(true);

    const importId = body.id;

    // Verify fetching import details by ID
    const importRes = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/products/imports/${importId}`,
      {
        headers: {
          Authorization: `Bearer ${tenant1Token}`,
        },
      },
    );
    expect(importRes.status).toBe(200);
    const importDetails = await importRes.json();
    expect(importDetails.id).toBe(importId);
    expect(importDetails.failedRows).toBe(2);
  });

  it('5. Enforces cross-tenant isolation: Tenant 2 cannot access Tenant 1 product', async () => {
    // Tenant 2 tries to GET Tenant 1 product using Tenant 1 workspace ID
    const resForbidden = await fetch(
      `${baseUrl}/workspaces/${tenant1WorkspaceId}/products/${createdProductId}`,
      {
        headers: {
          Authorization: `Bearer ${tenant2Token}`,
        },
      },
    );
    // Tenant 2 is not a member of Tenant 1 workspace -> 403 Forbidden
    expect(resForbidden.status).toBe(403);

    // Tenant 2 tries to access Tenant 1 product under Tenant 2 workspace ID
    const resNotFound = await fetch(
      `${baseUrl}/workspaces/${tenant2WorkspaceId}/products/${createdProductId}`,
      {
        headers: {
          Authorization: `Bearer ${tenant2Token}`,
        },
      },
    );
    // Product does not belong to Tenant 2 workspace -> 404 Not Found
    expect(resNotFound.status).toBe(404);
  });

  it('6. Enforces cross-tenant isolation: Tenant 2 cannot delete or update Tenant 1 product', async () => {
    const res = await fetch(
      `${baseUrl}/workspaces/${tenant2WorkspaceId}/products/${createdProductId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tenant2Token}`,
        },
      },
    );
    expect(res.status).toBe(404);
  });
});
