'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import { api, type ProductItem, type CatalogImportRecord } from '../../lib/api';
import { ProtectedRoute } from '../../components/protected-route';
import {
  Upload,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  X,
  Check,
  Download,
} from 'lucide-react';

interface RowError {
  rowNumber: number;
  sku?: string | undefined;
  title?: string | undefined;
  errors: string[];
}

const SAMPLE_CSV = `sku,title,description,price,inventory,tags
WHL-SND-01,Woven Leather Sandals,Handcrafted artisanal leather slide sandals,79.00,24,"footwear, summer"
BAD-ROW-02,,Missing title row should trigger error,19.99,10,test
BAD-ROW-03,Negative Price Item,Price cannot be negative,-15.00,5,test
SLK-SCF-04,Printed Silk Scarf,Pure mulberry silk bandana scarf,34.50,50,"accessories, silk"`;

export default function CatalogPage() {
  const { currentWorkspace, token } = useAuth();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStaleOnly, setFilterStaleOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Background import jobs state
  const [importHistory, setImportHistory] = useState<CatalogImportRecord[]>([]);

  // CSV Modal state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvContent, setCsvContent] = useState(SAMPLE_CSV);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    imported: number;
    failed: number;
    errors: RowError[];
  } | null>(null);

  // Manual Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newInventory, setNewInventory] = useState('10');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch products from backend API
  const fetchProducts = useCallback(async () => {
    if (!currentWorkspace?.id || !token) return;
    setIsLoading(true);
    try {
      const res = await api.getProducts(currentWorkspace.id, {
        search: searchQuery || undefined,
        limit: 50,
      });
      setProducts(res.items);
      setIsLiveConnected(true);
    } catch (err: unknown) {
      setIsLiveConnected(false);
      setActionError(err instanceof Error ? err.message : 'Failed to retrieve products from server');
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id, token, searchQuery]);

  useEffect(() => {
    if (currentWorkspace?.id && token) {
      void fetchProducts();
    }
  }, [fetchProducts, currentWorkspace?.id, token]);

  // Filter products locally for instantaneous responsiveness
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterStaleOnly && !p.isStale) return false;
    return true;
  });

  const staleCount = products.filter((p) => p.isStale).length;
  const inStockCount = products.filter((p) => p.inventoryCount > 0).length;

  const handleRefreshFreshness = async (id: string) => {
    setActionError(null);
    if (!currentWorkspace?.id || !token) return;
    try {
      await api.refreshProductFreshness(currentWorkspace.id, id);
      void fetchProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh product on server';
      setActionError(msg);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setActionError(null);
    if (!currentWorkspace?.id || !token) return;
    try {
      await api.deleteProduct(currentWorkspace.id, id);
      void fetchProducts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete product on server';
      setActionError(msg);
    }
  };

  const handleCsvImport = async () => {
    setIsImporting(true);
    setImportResult(null);
    setActionError(null);

    // If active workspace session, send to live backend API
    if (currentWorkspace?.id && token) {
      try {
        const record = await api.importCsv(currentWorkspace.id, {
          fileName: `catalog_import_${Date.now()}.csv`,
          csvContent,
        });

        setImportResult({
          total: record.totalRows,
          imported: record.importedRows,
          failed: record.failedRows,
          errors: (record.errors as RowError[]) || [],
        });

        setImportHistory((prev) => [record, ...prev]);
        void fetchProducts();
        setIsImporting(false);
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Server catalog import failed';
        setActionError(msg);
        setIsImporting(false);
        return;
      }
    }

    // In unauthenticated preview mode: show explicit guidance
    setActionError(
      'Authentication required. Sign in or connect to an active workspace to import catalog products.',
    );
    setIsImporting(false);
  };

  const handleDownloadErrorReport = () => {
    if (!importResult || importResult.errors.length === 0) return;

    const escapeCsv = (val: string | number | undefined | null) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = ['Row Number', 'SKU', 'Title', 'Errors'].join(',');
    const rows = importResult.errors.map((e) =>
      [
        escapeCsv(e.rowNumber),
        escapeCsv(e.sku || 'N/A'),
        escapeCsv(e.title || 'N/A'),
        escapeCsv(e.errors.join('; ')),
      ].join(','),
    );

    const csvData = [header, ...rows].join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalog_import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (!currentWorkspace?.id) {
      setActionError('Active workspace required to add product.');
      return;
    }
    setIsSaving(true);
    setActionError(null);

    const priceNum = parseFloat(newPrice) || 0;
    const invNum = parseInt(newInventory, 10) || 0;

    try {
      await api.createProduct(currentWorkspace.id, {
        title: newTitle.trim(),
        sku: newSku.trim() || undefined,
        priceCents: Math.round(priceNum * 100),
        currency: 'USD',
        inventoryCount: invNum,
        description: 'Manually added catalog product',
        tags: ['manual'],
      });
      void fetchProducts();
      setIsAddModalOpen(false);
      setNewTitle('');
      setNewSku('');
      setNewPrice('');
      setNewInventory('10');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create product on server');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ProtectedRoute
      fallbackTitle="Catalog Management Access"
      fallbackDescription="Sign in to your workspace to view, edit, and import catalog products."
    >
      <main className="min-h-screen px-4 py-8 md:px-8 max-w-7xl mx-auto space-y-6">
        {/* Top Controls / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E4E7EC] gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#17202A]">Product Catalog</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#16803C]/10 text-[#16803C] flex items-center">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Synchronized
              </span>
            </div>
            <p className="text-xs text-[#667085] mt-0.5">
              Manage product facts, monitor sync freshness, and import inventory with RFC 4180
              validation.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB] shadow-sm transition-all"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 text-[#667085]" />
              Import CSV
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#E85D2A] text-white hover:bg-[#d04e1f] shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Product
            </button>
          </div>
        </div>

        {/* Action Error Alert */}
        {actionError && (
          <div className="p-3 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-[#B42318] hover:text-[#912018]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 shadow-sm">
            <span className="text-[11px] font-medium text-[#667085] uppercase tracking-wider">
              Total Products
            </span>
            <div className="text-2xl font-bold text-[#17202A] mt-1">{products.length}</div>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 shadow-sm">
            <span className="text-[11px] font-medium text-[#667085] uppercase tracking-wider">
              In-Stock Items
            </span>
            <div className="text-2xl font-bold text-[#16803C] mt-1">{inStockCount}</div>
          </div>

          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 shadow-sm">
            <span className="text-[11px] font-medium text-[#667085] uppercase tracking-wider">
              Stale Warning Items (&gt;48h)
            </span>
            <div className="text-2xl font-bold text-[#B54708] mt-1">{staleCount}</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#667085]" />
            <input
              type="text"
              placeholder="Search by title, SKU, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-lg border border-[#D0D5DD] pl-9 pr-3 py-2 text-[#17202A] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setFilterStaleOnly(!filterStaleOnly)}
              className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStaleOnly
                  ? 'bg-[#B54708] text-white'
                  : 'border border-[#D0D5DD] text-[#344054] hover:bg-[#F9FAFB]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              {filterStaleOnly ? 'Showing Stale Only' : 'Filter Stale'}
            </button>

            {isLiveConnected && (
              <button
                type="button"
                onClick={() => void fetchProducts()}
                disabled={isLoading}
                className="inline-flex items-center p-2 rounded-lg border border-[#D0D5DD] text-[#667085] hover:text-[#17202A] hover:bg-[#F9FAFB]"
                title="Refresh Catalog"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Catalog Table */}
        <div className="bg-white rounded-xl border border-[#E4E7EC] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F8FA] border-b border-[#E4E7EC] text-[#667085] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Product / SKU</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Inventory</th>
                  <th className="py-3 px-4">Freshness Check</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EC]">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#667085]">
                      No products found. Import a CSV or click &quot;Add Product&quot; to get
                      started.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[#F9FAFB] transition-all">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#17202A]">{product.title}</div>
                        <div className="text-[10px] font-mono text-[#667085] flex items-center space-x-1.5 mt-0.5">
                          <span>SKU: {product.sku || 'N/A'}</span>
                          {product.tags.map((t) => (
                            <span
                              key={t}
                              className="bg-[#F2F4F7] text-[#344054] px-1 rounded text-[9px]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-medium text-[#17202A]">
                        ${(product.priceCents / 100).toFixed(2)} {product.currency}
                      </td>

                      <td className="py-3 px-4">
                        {product.inventoryCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#16803C]/10 text-[#16803C]">
                            {product.inventoryCount} in stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#B42318]/10 text-[#B42318]">
                            Out of stock
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {product.isStale ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFF9F5] border border-[#FECDCA] text-[#B54708]">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Stale (&gt;48h)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#16803C]/10 text-[#16803C]">
                            <Check className="w-3 h-3 mr-1" />
                            Fresh
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => void handleRefreshFreshness(product.id)}
                          className="inline-flex items-center p-1 rounded text-[#667085] hover:text-[#17202A] hover:bg-[#F2F4F7]"
                          title="Re-verify catalog freshness"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProduct(product.id)}
                          className="inline-flex items-center p-1 rounded text-[#667085] hover:text-[#B42318] hover:bg-[#FEF3F2]"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Background Worker Import History */}
        {importHistory.length > 0 && (
          <div className="bg-white rounded-xl border border-[#E4E7EC] p-4 shadow-sm space-y-2">
            <h3 className="text-xs font-bold text-[#17202A]">Recent Background Import Jobs</h3>
            <div className="space-y-1.5">
              {importHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[#F7F8FA] border border-[#E4E7EC]"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-[#17202A]">{item.fileName}</span>
                    <span className="text-[10px] text-[#667085]">
                      ({item.totalRows} total rows)
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] text-[#16803C] font-semibold">
                      {item.importedRows} imported
                    </span>
                    {item.failedRows > 0 && (
                      <span className="text-[11px] text-[#B42318] font-semibold">
                        {item.failedRows} failed
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.status === 'COMPLETED'
                          ? 'bg-[#16803C]/10 text-[#16803C]'
                          : item.status === 'PROCESSING'
                            ? 'bg-[#175CD3]/10 text-[#175CD3]'
                            : 'bg-[#B42318]/10 text-[#B42318]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CSV Import Modal with RFC 4180 Validation & Live Feedback */}
        {isCsvModalOpen && (
          <div className="fixed inset-0 bg-[#17202A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#E4E7EC] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-6 pb-4 border-b border-[#F2F4F7] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A]">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17202A]">RFC 4180 CSV Catalog Import</h3>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Batch import products with automatic header aliasing and line validation.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="text-[#98A2B3] hover:text-[#344054] p-1.5 rounded-lg hover:bg-[#F2F4F7] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <p className="text-xs text-[#667085]">
                  Paste standard CSV rows below. Header aliases (<code className="font-mono text-[#17202A] bg-[#F2F4F7] px-1 py-0.5 rounded">sku</code>, <code className="font-mono text-[#17202A] bg-[#F2F4F7] px-1 py-0.5 rounded">title</code>, <code className="font-mono text-[#17202A] bg-[#F2F4F7] px-1 py-0.5 rounded">price</code>, <code className="font-mono text-[#17202A] bg-[#F2F4F7] px-1 py-0.5 rounded">inventory</code>, <code className="font-mono text-[#17202A] bg-[#F2F4F7] px-1 py-0.5 rounded">tags</code>) are mapped automatically.
                </p>

                <div>
                  <textarea
                    rows={6}
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder="sku,title,price,inventory,tags&#10;SH-001,Linen Shirt,49.99,10,summer;apparel"
                    className="w-full text-xs font-mono rounded-xl border border-[#D0D5DD] p-3.5 text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs"
                  />
                </div>

                {/* Import Results Box */}
                {importResult && (
                  <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E4E7EC] space-y-2 text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-[#17202A]">Import Summary:</span>
                      <div className="flex space-x-2">
                        <span className="text-[#16803C] font-bold">{importResult.imported} Imported</span>
                        <span className="text-[#667085]">&bull;</span>
                        <span className="text-[#B42318] font-bold">{importResult.failed} Failed</span>
                      </div>
                    </div>

                    {importResult.errors.length > 0 && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-[#E4E7EC]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#B42318] font-medium">
                            Invalid rows were skipped and logged.
                          </span>
                          <button
                            type="button"
                            onClick={handleDownloadErrorReport}
                            className="inline-flex items-center px-2.5 py-1 text-[11px] font-semibold rounded bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA] hover:bg-[#FEE4E2] transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Download Error Report (.csv)
                          </button>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {importResult.errors.map((err, i) => (
                            <div
                              key={i}
                              className="p-2 rounded bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-[11px]"
                            >
                              <strong>Row {err.rowNumber}:</strong> {err.errors.join('; ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F2F4F7] flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F2F4F7] shadow-xs transition-all"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleCsvImport}
                  disabled={isImporting}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E85D2A] text-white hover:bg-[#d04e1f] disabled:opacity-50 flex items-center gap-2 shadow-xs transition-all"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Run Import'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Add Product Modal */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-[#17202A]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-[#E4E7EC] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-6 pb-4 border-b border-[#F2F4F7] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF9F5] border border-[#E85D2A]/20 flex items-center justify-center text-[#E85D2A]">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#17202A]">Add Catalog Product</h3>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Enter product facts to populate your marketing catalog.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-[#98A2B3] hover:text-[#344054] p-1.5 rounded-lg hover:bg-[#F2F4F7] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleManualAdd}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1.5">Product Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Leather Oxford Shoes"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#344054] mb-1.5">SKU</label>
                    <input
                      type="text"
                      placeholder="e.g. OXF-SHOE-01"
                      value={newSku}
                      onChange={(e) => setNewSku(e.target.value)}
                      className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#344054] mb-1.5">Price ($ USD) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="49.99"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#344054] mb-1.5">Inventory</label>
                      <input
                        type="number"
                        min="0"
                        value={newInventory}
                        onChange={(e) => setNewInventory(e.target.value)}
                        className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#D0D5DD] bg-white text-[#17202A] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#E85D2A]/20 focus:border-[#E85D2A] transition-all shadow-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F2F4F7] flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-[#D0D5DD] bg-white text-[#344054] rounded-xl text-xs font-semibold hover:bg-[#F2F4F7] shadow-xs transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-[#E85D2A] text-white rounded-xl text-xs font-bold hover:bg-[#d04e1f] shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Add to Catalog'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </ProtectedRoute>
  );
}
