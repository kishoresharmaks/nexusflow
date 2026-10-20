import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { ImportCsvDto } from './dto/import-csv.dto';
import { parseProductCsv } from './csv/csv-parser';
import { Product, CatalogImport, ImportStatus, Prisma } from '@commercepilot/database';

export interface ProductWithFreshness extends Product {
  isStale: boolean;
}

export interface PaginatedProducts {
  items: ProductWithFreshness[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private readonly STALE_THRESHOLD_HOURS = 48;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Computes whether product data is considered stale for AI generation/publishing.
   * Product data older than 48 hours without a freshness check is flagged as stale.
   */
  public computeIsStale(product: Pick<Product, 'freshnessCheckedAt' | 'updatedAt'>): boolean {
    const timestamp = product.freshnessCheckedAt ?? product.updatedAt;
    if (!timestamp) return true;
    const ageMs = Date.now() - new Date(timestamp).getTime();
    return ageMs > this.STALE_THRESHOLD_HOURS * 60 * 60 * 1000;
  }

  private validateObjectId(id: string, label = 'ID'): void {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException(`Invalid ${label} format.`);
    }
  }

  /**
   * Create a single product within a workspace.
   */
  async createProduct(
    workspaceId: string,
    dto: CreateProductDto,
    userId: string,
    clientIp?: string,
  ): Promise<ProductWithFreshness> {
    this.validateObjectId(workspaceId, 'workspace ID');

    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { workspaceId, sku: dto.sku },
      });
      if (existing) {
        throw new ConflictException(
          `Product with SKU "${dto.sku}" already exists in this workspace.`,
        );
      }
    }

    const now = new Date();
    const product = await this.prisma.product.create({
      data: {
        workspaceId,
        sku: dto.sku ?? null,
        title: dto.title,
        description: dto.description ?? null,
        priceCents: dto.priceCents,
        currency: (dto.currency || 'USD').toUpperCase(),
        inventoryCount: dto.inventoryCount ?? 0,
        url: dto.url ?? null,
        images: dto.images ?? [],
        tags: dto.tags ?? [],
        source: dto.source || 'MANUAL',
        sourceId: dto.sourceId ?? null,
        isActive: true,
        freshnessCheckedAt: now,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'PRODUCT_CREATED',
      resourceType: 'Product',
      resourceId: product.id,
      metadata: {
        sku: product.sku,
        title: product.title,
        priceCents: product.priceCents,
      },
      ipAddress: clientIp,
    });

    return {
      ...product,
      isStale: false,
    };
  }

  /**
   * List and search products in a workspace with pagination.
   */
  async findProducts(workspaceId: string, query: QueryProductsDto): Promise<PaginatedProducts> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      workspaceId,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.source) {
      where.source = query.source;
    }

    if (query.search && query.search.trim().length > 0) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { tags: { has: term } },
      ];
    }

    const sortOrder: Prisma.SortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [query.sortBy || 'createdAt']: sortOrder,
    };

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    return {
      items: items.map((p) => ({
        ...p,
        isStale: this.computeIsStale(p),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get a single product by ID ensuring workspace boundary.
   */
  async getProductById(workspaceId: string, productId: string): Promise<ProductWithFreshness> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(productId, 'product ID');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId },
    });

    if (!product) {
      throw new NotFoundException('Product not found in this workspace.');
    }

    return {
      ...product,
      isStale: this.computeIsStale(product),
    };
  }

  /**
   * Update product properties within workspace.
   */
  async updateProduct(
    workspaceId: string,
    productId: string,
    dto: UpdateProductDto,
    userId: string,
    clientIp?: string,
  ): Promise<ProductWithFreshness> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(productId, 'product ID');

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Product not found in this workspace.');
    }

    if (dto.sku && dto.sku !== existing.sku) {
      const conflict = await this.prisma.product.findFirst({
        where: {
          workspaceId,
          sku: dto.sku,
          id: { not: productId },
        },
      });
      if (conflict) {
        throw new ConflictException(
          `Product with SKU "${dto.sku}" already exists in this workspace.`,
        );
      }
    }

    const data: Prisma.ProductUpdateInput = {
      freshnessCheckedAt: new Date(),
    };

    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.currency !== undefined) data.currency = dto.currency.toUpperCase();
    if (dto.inventoryCount !== undefined) data.inventoryCount = dto.inventoryCount;
    if (dto.url !== undefined) data.url = dto.url;
    if (dto.images !== undefined) data.images = dto.images;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data,
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'PRODUCT_UPDATED',
      resourceType: 'Product',
      resourceId: productId,
      metadata: { changes: Object.keys(dto) },
      ipAddress: clientIp,
    });

    return {
      ...updated,
      isStale: false,
    };
  }

  /**
   * Delete product ensuring workspace boundary.
   */
  async deleteProduct(
    workspaceId: string,
    productId: string,
    userId: string,
    clientIp?: string,
  ): Promise<{ success: boolean; id: string }> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(productId, 'product ID');

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Product not found in this workspace.');
    }

    await this.prisma.product.delete({
      where: { id: productId },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'PRODUCT_DELETED',
      resourceType: 'Product',
      resourceId: productId,
      metadata: { sku: existing.sku, title: existing.title },
      ipAddress: clientIp,
    });

    return { success: true, id: productId };
  }

  /**
   * Refresh product freshness timestamp.
   */
  async refreshProductFreshness(
    workspaceId: string,
    productId: string,
    userId: string,
    clientIp?: string,
  ): Promise<ProductWithFreshness> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(productId, 'product ID');

    const existing = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException('Product not found in this workspace.');
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: { freshnessCheckedAt: new Date() },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'PRODUCT_FRESHNESS_CHECKED',
      resourceType: 'Product',
      resourceId: productId,
      ipAddress: clientIp,
    });

    return {
      ...updated,
      isStale: false,
    };
  }

  /**
   * Import CSV catalog with row-level validation and error tracking.
   */
  async importCsv(
    workspaceId: string,
    dto: ImportCsvDto,
    userId: string,
    clientIp?: string,
  ): Promise<CatalogImport> {
    this.validateObjectId(workspaceId, 'workspace ID');

    const importRecord = await this.prisma.catalogImport.create({
      data: {
        workspaceId,
        fileName: dto.fileName,
        status: ImportStatus.PROCESSING,
        totalRows: 0,
        importedRows: 0,
        failedRows: 0,
      },
    });

    const parsed = parseProductCsv(dto.csvContent, dto.defaultCurrency || 'USD');
    const now = new Date();
    let importedCount = 0;

    // Process valid rows
    for (const row of parsed.validRows) {
      if (row.sku) {
        // Upsert matching SKU
        const existing = await this.prisma.product.findFirst({
          where: { workspaceId, sku: row.sku },
        });

        if (existing) {
          await this.prisma.product.update({
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
              source: 'CSV',
              freshnessCheckedAt: now,
            },
          });
          importedCount++;
          continue;
        }
      }

      // Create new product
      await this.prisma.product.create({
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
          source: 'CSV',
          isActive: true,
          freshnessCheckedAt: now,
        },
      });
      importedCount++;
    }

    const finalStatus: ImportStatus =
      importedCount > 0
        ? ImportStatus.COMPLETED
        : parsed.errors.length > 0
          ? ImportStatus.FAILED
          : ImportStatus.COMPLETED;

    const updatedImport = await this.prisma.catalogImport.update({
      where: { id: importRecord.id },
      data: {
        status: finalStatus,
        totalRows: parsed.totalRows,
        importedRows: importedCount,
        failedRows: parsed.errors.length,
        errors:
          parsed.errors.length > 0 ? (parsed.errors as unknown as Prisma.InputJsonValue) : null,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'CATALOG_IMPORTED',
      resourceType: 'CatalogImport',
      resourceId: updatedImport.id,
      metadata: {
        fileName: dto.fileName,
        totalRows: parsed.totalRows,
        importedRows: importedCount,
        failedRows: parsed.errors.length,
        status: finalStatus,
      },
      ipAddress: clientIp,
    });

    return updatedImport;
  }

  /**
   * List recent catalog imports.
   */
  async getCatalogImports(workspaceId: string): Promise<CatalogImport[]> {
    this.validateObjectId(workspaceId, 'workspace ID');
    return this.prisma.catalogImport.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Get specific catalog import details with error report.
   */
  async getCatalogImportById(workspaceId: string, importId: string): Promise<CatalogImport> {
    this.validateObjectId(workspaceId, 'workspace ID');
    this.validateObjectId(importId, 'import ID');

    const item = await this.prisma.catalogImport.findFirst({
      where: { id: importId, workspaceId },
    });

    if (!item) {
      throw new NotFoundException('Catalog import not found in this workspace.');
    }

    return item;
  }
}
