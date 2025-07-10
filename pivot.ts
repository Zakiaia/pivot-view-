export interface PivotData {
  [key: string]: any;
}

export interface PivotConfig {
  rows: string[];
  columns: string[];
  values: string[];
  aggregation?: 'sum' | 'count' | 'avg' | 'min' | 'max';
}

export interface PivotResult {
  data: number[][];
  rowHeaders: string[];
  columnHeaders: string[];
}

export function createPivotTable(
  data: PivotData[],
  config: PivotConfig
): PivotResult {
  const { rows, columns, values, aggregation = 'sum' } = config;
  
  if (!data || data.length === 0) {
    return {
      data: [],
      rowHeaders: [],
      columnHeaders: []
    };
  }

  // Get unique values for row and column headers
  const rowHeaders = getUniqueValues(data, rows);
  const columnHeaders = getUniqueValues(data, columns);

  // Create pivot table data
  const pivotData: number[][] = [];
  
  for (let i = 0; i < rowHeaders.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < columnHeaders.length; j++) {
      const filteredData = data.filter(item => 
        matchesGroup(item, rows, rowHeaders[i]) && 
        matchesGroup(item, columns, columnHeaders[j])
      );
      
      const aggregatedValue = aggregateValues(filteredData, values, aggregation);
      row.push(aggregatedValue);
    }
    pivotData.push(row);
  }

  return {
    data: pivotData,
    rowHeaders,
    columnHeaders
  };
}

function getUniqueValues(data: PivotData[], fields: string[]): string[] {
  const uniqueValues = new Set<string>();
  
  data.forEach(item => {
    const value = fields.map(field => item[field]).join(' - ');
    uniqueValues.add(value);
  });
  
  return Array.from(uniqueValues).sort();
}

function matchesGroup(item: PivotData, fields: string[], groupValue: string): boolean {
  const itemValue = fields.map(field => item[field]).join(' - ');
  return itemValue === groupValue;
}

function aggregateValues(
  data: PivotData[], 
  valueFields: string[], 
  aggregation: string
): number {
  if (data.length === 0) return 0;
  
  const values = data.flatMap(item => 
    valueFields.map(field => parseFloat(item[field]) || 0)
  );
  
  switch (aggregation) {
    case 'sum':
      return values.reduce((sum, val) => sum + val, 0);
    case 'count':
      return values.length;
    case 'avg':
      return values.reduce((sum, val) => sum + val, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return values.reduce((sum, val) => sum + val, 0);
  }
} 