import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { ProductsService, ProductWithFreshness, PaginatedProducts } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { ImportCsvDto } from './dto/import-csv.dto';
import { AuthGuard, AuthenticatedUser } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRole, CatalogImport } from '@commercepilot/database';

@ApiTags('Products & Catalog')
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Create a new product in the workspace catalog' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 409, description: 'Product SKU already exists in this workspace' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ProductWithFreshness> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.productsService.createProduct(workspaceId, dto, user.id, ip);
  }

  @Get()
  @ApiOperation({ summary: 'List and search workspace products with pagination' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Paginated list of products with freshness metadata' })
  async list(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryProductsDto,
  ): Promise<PaginatedProducts> {
    return this.productsService.findProducts(workspaceId, query);
  }

  @Post('import-csv')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Import catalog products from CSV content with row-level validation' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'CSV import processed; row-level errors reported' })
  async importCsv(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ImportCsvDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CatalogImport> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.productsService.importCsv(workspaceId, dto, user.id, ip);
  }

  @Get('imports')
  @ApiOperation({ summary: 'List recent catalog CSV imports' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'List of catalog import records' })
  async listImports(@Param('workspaceId') workspaceId: string): Promise<CatalogImport[]> {
    return this.productsService.getCatalogImports(workspaceId);
  }

  @Get('imports/:importId')
  @ApiOperation({ summary: 'Get details and row-level error report for a catalog import' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'importId', description: 'Catalog import record ID' })
  @ApiResponse({ status: 200, description: 'Catalog import record with error details' })
  @ApiResponse({ status: 404, description: 'Import record not found' })
  async getImport(
    @Param('workspaceId') workspaceId: string,
    @Param('importId') importId: string,
  ): Promise<CatalogImport> {
    return this.productsService.getCatalogImportById(workspaceId, importId);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get details for a single product with freshness status' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found in this workspace' })
  async getOne(
    @Param('workspaceId') workspaceId: string,
    @Param('productId') productId: string,
  ): Promise<ProductWithFreshness> {
    return this.productsService.getProductById(workspaceId, productId);
  }

  @Patch(':productId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Update product details' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ProductWithFreshness> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.productsService.updateProduct(workspaceId, productId, dto, user.id, ip);
  }

  @Delete(':productId')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a product from the workspace (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<{ success: boolean; id: string }> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.productsService.deleteProduct(workspaceId, productId, user.id, ip);
  }

  @Post([':productId/freshness', ':productId/refresh-freshness'])
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  @ApiOperation({ summary: 'Trigger manual freshness verification for a product' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product freshness confirmed and refreshed' })
  async refreshFreshness(
    @Param('workspaceId') workspaceId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ProductWithFreshness> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.productsService.refreshProductFreshness(workspaceId, productId, user.id, ip);
  }
}
