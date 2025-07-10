import React from 'react';
import { PivotData, PivotConfig, createPivotTable } from './pivot';

interface PivotTableProps {
  data: PivotData[];
  config: PivotConfig;
  className?: string;
}

const PivotTable: React.FC<PivotTableProps> = ({ data, config, className }) => {
  const pivotResult = createPivotTable(data, config);
  const { data: pivotData, rowHeaders, columnHeaders } = pivotResult;

  if (pivotData.length === 0) {
    return (
      <div className={`pivot-table-empty ${className || ''}`}>
        <p>No data to display</p>
      </div>
    );
  }

  return (
    <div className={`pivot-table-container ${className || ''}`}>
      <table className="pivot-table">
        <thead>
          <tr>
            <th className="pivot-table-header-corner">
              {config.rows.join(' / ')}
            </th>
            {columnHeaders.map((header, index) => (
              <th key={index} className="pivot-table-column-header">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pivotData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <th className="pivot-table-row-header">
                {rowHeaders[rowIndex]}
              </th>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="pivot-table-cell">
                  {typeof cell === 'number' ? formatNumber(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function formatNumber(value: number): string {
  if (value === 0) return '0';
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}

export default PivotTable; 