import React from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeader } from '../../../../../components/tailwindui/table';
import type { ComponentCostWithYears } from '../../../../Project/Model.d';

interface AnnualProjectData {
  id: number;
  program: string;
  description: string;
  componentId: string;
  total: number;
  allocations: { [year: number]: number };
}

interface ComponentProjectionTabProps {
  componentCosts: ComponentCostWithYears[];
  projectId?: string;
  multiYearProjectId?: string;
}

const ComponentProjectionTab: React.FC<ComponentProjectionTabProps> = ({
  componentCosts,
  projectId, // TODO: Use for API calls to get actual annual project data
  multiYearProjectId // TODO: Use to link with annual projects
}) => {
  
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-PH');
  };

  // Define the years we want to show (you can make this dynamic)
//   const years = [2016, 2017, 2018, 2019, 2020, 2021];

    const years: number[] = Array.from(
      new Set(
        componentCosts.flatMap(cost =>
          (cost.CostPerYear ?? []).map(yearCost => yearCost.CostYear)
        )
      )
    ).sort((a, b) => a - b);

  // Process multi-year projected data from componentCosts
  const getProjectedData = () => {
    return componentCosts.map(cost => {
      const yearlyBreakdown: { [year: number]: number } = {};
      let total = 0;

      // Process the cost per year data
      if (cost.CostPerYear && cost.CostPerYear.length > 0) {
        cost.CostPerYear.forEach(yearCost => {
          yearlyBreakdown[yearCost.CostYear] = yearCost.Cost;
          total += yearCost.Cost;
        });
      }

      return {
        id: cost.Id,
        program: 'Multi-Year Planning', // This is the projected data
        description: cost.Description,
        componentId: cost.ComponentId,
        componentType: cost.ComponentType,
        total: total,
        allocations: yearlyBreakdown,
        isProjection: true // Flag to identify this as projection data
      };
    });
  };

  // Hardcoded annual project data (as per your request)
  const getAnnualProjectData = (): AnnualProjectData[] => {
    return [
      {
        id: 1,
        program: 'GAA 2025',
        description: 'Airport-Turnover Civil Works Implementation',
        componentId: 'P00002809MN-CW1',
        total: 141000,
        allocations: { 2025: 141000 }
      },
      {
        id: 2,
        program: 'GAA 2026',
        description: 'Airport-Turnover Infrastructure Development',
        componentId: 'P00109713MN-CW1',
        total: 100000,
        allocations: { 2026: 100000 }
      },
      {
        id: 3,
        program: 'NEP 2027',
        description: 'Airport-Turnover Expansion Project',
        componentId: 'P00251630MN-CW1',
        total: 40000,
        allocations: { 2027: 40000 }
      }
    ];
  };

  const projectedData = getProjectedData();
  const annualProjectData = getAnnualProjectData();

  // Calculate totals for each year
  const calculateYearlyTotals = () => {
    const totals: { [year: number]: number } = {};
    
    // Add projected amounts
    projectedData.forEach(item => {
      years.forEach(year => {
        if(year === undefined) return;
        if (!totals[year]) totals[year] = 0;
        totals[year] += item.allocations[year] || 0;
      });
    });

    // Add annual project amounts
    annualProjectData.forEach(item => {
      years.forEach(year => {
        if(year === undefined) return;
        if (!totals[year]) totals[year] = 0;
        totals[year] += item.allocations[year] || 0;
      });
    });

    return totals;
  };

  const yearlyTotals = calculateYearlyTotals();
//   const grandTotal = Object.values(yearlyTotals).reduce((sum, amount) => sum + amount, 0);

  return (
    <div className="p-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Multi-Year Projected</div>
          <div className="text-lg font-semibold text-blue-600">
            ₱{formatCurrency(projectedData.reduce((sum, item) => sum + item.total, 0))}
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Annual Projects Total</div>
          <div className="text-lg font-semibold text-green-600">
            ₱{formatCurrency(annualProjectData.reduce((sum, item) => sum + item.total, 0))}
          </div>
        </div>
        {/* <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">Combined Total</div>
          <div className="text-lg font-semibold text-orange-600">
            ₱{formatCurrency(grandTotal)}
          </div>
        </div> */}
      </div>

      {/* Main Comparison Table */}
      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>Type/Source</TableHeader>
            <TableHeader>Description</TableHeader>
            <TableHeader>Comp ID</TableHeader>
            <TableHeader className="text-right">Total</TableHeader>
            {years.map(year => (
              <TableHeader key={year} className="text-right">{year}</TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {/* Multi-Year Projected Data Rows */}
          {projectedData.map((item) => (
            <TableRow key={`projected-${item.id}`} className="bg-blue-50 font-medium">
              <TableCell className="font-semibold text-blue-800">{item.componentType}</TableCell>
              <TableCell className="text-blue-700">{item.description}</TableCell>
              <TableCell className="font-mono text-blue-700">{item.componentId}</TableCell>
              <TableCell className="text-right font-semibold text-blue-800">
                ₱{formatCurrency(item.total)}
              </TableCell>
              {years.map(year => (
                <TableCell key={year} className="text-right text-blue-700">
                  {item.allocations[year] ? `₱${formatCurrency(item.allocations[year])}` : '-'}
                </TableCell>
              ))}
            </TableRow>
          ))}

          {/* Subtotal Row for Projected Data */}
          {projectedData.length > 0 && (
            <TableRow className="bg-blue-100 font-bold border-b-2">
              <TableCell colSpan={3} className="text-blue-800">Projected Subtotal</TableCell>
              <TableCell className="text-right text-blue-800">
                ₱{formatCurrency(projectedData.reduce((sum, item) => sum + item.total, 0))}
              </TableCell>
              {years.map(year => {
                const yearTotal = projectedData.reduce((sum, item) => sum + (item.allocations[year] || 0), 0);
                return (
                  <TableCell key={year} className="text-right text-blue-800">
                    {yearTotal > 0 ? `₱${formatCurrency(yearTotal)}` : '-'}
                  </TableCell>
                );
              })}
            </TableRow>
          )}

          {/* Annual Project Data Rows */}
          {annualProjectData.map((item) => (
            <TableRow key={`annual-${item.id}`} className="hover:bg-gray-50">
              <TableCell className="font-medium text-gray-700">{item.program}</TableCell>
              <TableCell className="text-gray-600">{item.description}</TableCell>
              <TableCell className="font-mono text-gray-600">{item.componentId}</TableCell>
              <TableCell className="text-right font-medium">
                ₱{formatCurrency(item.total)}
              </TableCell>
              {years.map(year => (
                <TableCell key={year} className="text-right">
                  {item.allocations[year] ? `₱${formatCurrency(item.allocations[year])}` : '-'}
                </TableCell>
              ))}
            </TableRow>
          ))}

          {/* Grand Total Row */}
          {/* <TableRow className="bg-gray-100 font-bold border-t-2">
            <TableCell colSpan={3} className="text-gray-800 text-lg">GRAND TOTAL</TableCell>
            <TableCell className="text-right text-lg text-gray-800">
              ₱{formatCurrency(grandTotal)}
            </TableCell>
            {years.map(year => (
              <TableCell key={year} className="text-right text-gray-800 font-semibold">
                {yearlyTotals[year] ? `₱${formatCurrency(yearlyTotals[year])}` : '-'}
              </TableCell>
            ))}
          </TableRow> */}
        </TableBody>
      </Table>

      {/* Legend */}
      {/* <div className="mt-6 border-t pt-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Legend:</h4>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded mr-2"></div>
            <span className="text-gray-700">Multi-Year Projected Data</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-white border border-gray-300 rounded mr-2"></div>
            <span className="text-gray-700">Annual Project Allocations</span>
          </div>
        </div>
      </div> */}

      {/* Analysis Notes */}
      {/* <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <h5 className="text-sm font-medium text-amber-800 mb-2">Analysis Notes:</h5>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• Blue rows represent your multi-year project estimates</li>
          <li>• White rows represent actual annual project allocations</li>
          <li>• Compare projected vs actual to identify funding gaps or overallocations</li>
          <li>• Use this analysis to adjust future year projections</li>
        </ul>
      </div> */}
    </div>
  );
};

export default ComponentProjectionTab;