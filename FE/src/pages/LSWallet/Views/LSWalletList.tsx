// =============================================================================
// LSWalletList.tsx — LS Wallet list page
//
// Top-level route page (no props) — displays paginated wallet list with:
//   - CollapsibleTable with wallet columns
//   - Pagination controls
//   - Search/filter header
//   - "Add Wallet" primary button (navigates to /lumpsum/add)
//   - "[Dev] Advance Program Stage" button (dev simulation tool)
//   - WalletActionButtons per row for wallet-level actions
//
// Data: fetched via Service.fetchWalletList() on mount and pagination changes
// Balances: fetched via useAllWalletBalances() hook (avoids N individual fetches)
// =============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pagination,
  PaginationPrevious,
  PaginationNext,
  PaginationList,
  PaginationPage,
  PaginationGap,
} from '../../../components/tailwindui/pagination';
import { CollapsibleTable } from '../../../components/tailwindui/collapsible-table';
import { Button } from '../../../components/tailwindui/button';
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import * as Service from '../Service';
import { useAllWalletBalances } from '../hooks/useWalletBalance';
import WalletStatusBadge from '../utils/walletStatusBadge';
import AdvanceProgramStageDialog from '../dialogs/AdvanceProgramStageDialog';
import type { LSWallet, LSWalletPagination, WalletStage } from '../Model.d';

interface PaginationResponse<T> {
  lists: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const LSWalletList: React.FC = () => {
  const navigate = useNavigate();
  const allBalances = useAllWalletBalances();

  // Wallet list state
  const [walletData, setWalletData] = useState<PaginationResponse<LSWallet>>({
    lists: [],
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [pagination, setPagination] = useState<LSWalletPagination>({
    page: 1,
    limit: 10,
  });

  // Search state
  const [searchInput, setSearchInput] = useState('');

  // Dialog state
  const [isAdvanceStageOpen, setIsAdvanceStageOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<{ id: string; name: string; stage: WalletStage } | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch wallet list
  const fetchWallets = async (params: LSWalletPagination) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await Service.fetchWalletList(params);
      if (response.Status === 200) {
        setWalletData(response.Data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wallets');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchWallets(pagination);
  }, []);

  // Handle pagination change
  const handlePageChange = (newPage: number) => {
    const newPagination = { ...pagination, page: newPage };
    setPagination(newPagination);
    fetchWallets(newPagination);
  };

  // Handle search submit
  const handleSearchSubmit = () => {
    const newPagination = {
      ...pagination,
      page: 1,
      filters: searchInput
        ? {
            OperatingUnit: searchInput,
          }
        : undefined,
    };
    setPagination(newPagination);
    fetchWallets(newPagination);
  };

  // Handle search clear
  const handleSearchClear = () => {
    setSearchInput('');
    const newPagination = {
      ...pagination,
      page: 1,
      filters: undefined,
    };
    setPagination(newPagination);
    fetchWallets(newPagination);
  };

  // Handle advance stage success
  const handleAdvanceStageSuccess = () => {
    setIsAdvanceStageOpen(false);
    setSelectedProgram(null);
    fetchWallets(pagination);
  };

  // Helper to get balance for a wallet
  const getWalletBalance = (walletId: number) => {
    return allBalances.find((b) => b.WalletId === walletId) || {
      WalletId: walletId,
      Total: 0,
      Used: 0,
      Available: 0,
    };
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH')}`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Row actions — full action set (Replenish/Add Itemized/Delete) requires the
  // itemized-projects list for correct delete-tier resolution, so those live on
  // the Detail page. The list row only needs to get you there, plus the dev
  // stage-cascade simulation which is self-contained.
  const renderWalletActions = (wallet: LSWallet) => (
    <div className="flex items-center gap-2">
      <Button color="blue" onClick={() => navigate(`/lumpsum/${wallet.Id}`)}>
        View
        <ArrowRightIcon className="w-3 h-3" />
      </Button>
      <Button
        color="zinc"
        onClick={() => {
          setSelectedProgram({
            id: wallet.ProgramId,
            name: wallet.ProgramName,
            stage: wallet.CurrentStage,
          });
          setIsAdvanceStageOpen(true);
        }}
      >
        [Dev] Advance Stage
      </Button>
    </div>
  );

  return (
    <div className="max-w-10xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-hidden">
          {/* Header strip with title, search, and add button */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">LS Wallets</h3>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by Operating Unit..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchSubmit();
                        }
                      }}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <Button
                    color="blue"
                    onClick={handleSearchSubmit}
                    className="text-xs px-3 py-1.5"
                  >
                    <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                    Search
                  </Button>
                  {searchInput && (
                    <Button
                      color="zinc"
                      onClick={handleSearchClear}
                      className="text-xs px-3 py-1.5"
                    >
                      <XMarkIcon className="w-4 h-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
                <Button color="green" onClick={() => navigate('/lumpsum/add')}>
                  <PlusIcon className="w-4 h-4 mr-1" />
                  Add Wallet
                </Button>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="px-6 py-4 bg-red-50 border-b border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading wallets...</div>
            </div>
          )}

          {/* Wallet table */}
          {!isLoading && walletData.lists.length > 0 && (
            <>
              <CollapsibleTable
                columns={[
                  {
                    header: 'Wallet ID',
                    render: (wallet) => <span className="font-mono text-sm">{wallet.Id}</span>,
                  },
                  {
                    header: 'Program Name',
                    render: (wallet) => wallet.ProgramName,
                  },
                  {
                    header: 'Category',
                    render: (wallet) => wallet.CategoryName,
                  },
                  {
                    header: 'Stage',
                    render: (wallet) => (
                      <WalletStatusBadge stage={wallet.CurrentStage} />
                    ),
                  },
                  {
                    header: 'Total / Available',
                    render: (wallet) => {
                      const balance = getWalletBalance(wallet.Id);
                      return (
                        <div className="text-sm">
                          <div>{formatCurrency(balance.Total)}</div>
                          <div className="text-gray-500">{formatCurrency(balance.Available)} avail</div>
                        </div>
                      );
                    },
                  },
                  {
                    header: 'Created',
                    render: (wallet) => (
                      <span className="text-sm text-gray-600">{formatDate(wallet.CreatedDate)}</span>
                    ),
                  },
                  {
                    header: 'Actions',
                    render: (wallet) => renderWalletActions(wallet),
                  },
                ]}
                data={walletData.lists}
                rowKey={(wallet) => String(wallet.Id)}
                isRowExpanded={() => false}
                onToggleRow={() => {}}
              />

              {/* Pagination */}
              <Pagination className="my-6">
                <PaginationPrevious
                  onClick={() => handlePageChange(walletData.page - 1)}
                  disabled={walletData.page === 1}
                />
                <PaginationList>
                  {Array.from({ length: walletData.totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === walletData.totalPages ||
                      (page >= walletData.page - 1 && page <= walletData.page + 1)
                    ) {
                      return (
                        <PaginationPage
                          key={page}
                          onClick={() => handlePageChange(page)}
                          current={page === walletData.page}
                        >
                          {page}
                        </PaginationPage>
                      );
                    } else if (page === walletData.page - 2 || page === walletData.page + 2) {
                      return <PaginationGap key={`gap-${page}`} />;
                    }
                    return null;
                  })}
                </PaginationList>
                <PaginationNext
                  onClick={() => handlePageChange(walletData.page + 1)}
                  disabled={walletData.page === walletData.totalPages}
                />
              </Pagination>

              <div className="mb-3.5 text-center">
                <p className="text-sm text-gray-500">
                  Showing {walletData.lists.length} of {walletData.total} wallets
                </p>
              </div>
            </>
          )}

          {/* Empty state */}
          {!isLoading && walletData.lists.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600">No wallets found.</p>
              <Button color="green" onClick={() => navigate('/lumpsum/add')} className="mt-4">
                <PlusIcon className="w-4 h-4 mr-1" />
                Create Your First Wallet
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {selectedProgram && (
        <AdvanceProgramStageDialog
          open={isAdvanceStageOpen}
          onClose={() => {
            setIsAdvanceStageOpen(false);
            setSelectedProgram(null);
          }}
          onSuccess={handleAdvanceStageSuccess}
          programId={selectedProgram.id}
          programName={selectedProgram.name}
          currentStage={selectedProgram.stage}
        />
      )}
    </div>
  );
};

export default LSWalletList;
