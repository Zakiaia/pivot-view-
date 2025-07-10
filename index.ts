import { createPivotTable, PivotData, PivotConfig } from "./pivot";

// Define the structure of monday.com API response
interface MondayItem {
  name: string;
  column_values: {
    title: string;
    text: string;
    value: string;
  }[];
}

interface MondayAPIResponse {
  data: {
    boards: {
      items: MondayItem[];
    }[];
  };
}

// Monday.com API function - works when running inside Monday.com or with MCP
function mondayAPI() {
  return {
    async call(method: string, params: any): Promise<MondayAPIResponse> {
      try {
        // Check if we're running inside Monday.com and SDK is available
        if (typeof window !== 'undefined' && (window as any).mondaySDK) {
          console.log('🔗 Using Monday.com SDK');
          const sdk = (window as any).mondaySDK;
          const variables = typeof params.variables === 'string' ? JSON.parse(params.variables) : params.variables;
          return await sdk.api(params.query, { variables });
        } 
        // Check if we're running inside Monday.com but SDK not loaded yet
        else if (typeof window !== 'undefined' && window.location.hostname.includes('monday.com')) {
          console.log('🔗 Detected Monday.com environment, waiting for SDK...');
          // Wait for SDK to load
          let attempts = 0;
          while (attempts < 10 && !(window as any).mondaySDK) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }
          
          if ((window as any).mondaySDK) {
            console.log('🔗 Monday.com SDK now available');
            const sdk = (window as any).mondaySDK;
            const variables = typeof params.variables === 'string' ? JSON.parse(params.variables) : params.variables;
            return await sdk.api(params.query, { variables });
          } else {
            throw new Error('Monday.com SDK failed to load');
          }
        }
        // Fallback to MCP if available
        else if (typeof window !== 'undefined') {
          console.log('🔗 Trying MCP connection...');
          const response = await fetch('http://localhost:19626/rpc', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'tools/call',
              params: {
                name: `mcp_monday-api-mcp_${method}`,
                arguments: params
              },
              id: 1
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          
          if (result.error) {
            throw new Error(`MCP Error: ${result.error.message}`);
          }

          return result.result;
        } else {
          throw new Error('Neither Monday.com SDK nor MCP connection available');
        }
      } catch (error) {
        console.error('Monday.com API Connection Error:', error);
        throw error;
      }
    }
  };
}

export async function fetchPivotData(boardId: number) {
  console.log(`🔍 Attempting to fetch data from Monday.com board: ${boardId}`);
  
  // Check if we're running inside Monday.com
  const isInsideMonday = typeof window !== 'undefined' && 
    (window.location.hostname.includes('monday.com') || window.location.hostname.includes('mondayapps.com'));
  
  console.log('🏠 Running inside Monday.com:', isInsideMonday);
  console.log('🌐 Current hostname:', typeof window !== 'undefined' ? window.location.hostname : 'undefined');
  
  if (isInsideMonday) {
    console.log('🔧 Using Monday.com environment API...');
    
    // Try to use Monday.com's built-in API
    const query = `
      query ($boardId: Int!) {
        boards(ids: [$boardId]) {
          items {
            name
            column_values {
              title
              text
              value
            }
          }
        }
      }
    `;

    try {
      // Method 1: Try window.monday if available
      if ((window as any).monday) {
        console.log('🔗 Using window.monday API');
        const result = await (window as any).monday.api(query, { variables: { boardId } });
        console.log('📦 Raw API response:', result);
        
        if (result.data && result.data.boards && result.data.boards[0]) {
          const items = result.data.boards[0].items;
          console.log(`📊 Found ${items.length} items in board ${boardId}`);
          
          const data: PivotData[] = items.map((item: any) => {
            const row: Record<string, any> = { name: item.name };
            item.column_values.forEach((col: any) => {
              row[col.title] = isNaN(Number(col.text)) ? col.text : Number(col.text);
            });
            return row;
          });
          
          console.log('✅ Successfully transformed data:', data);
          return data;
        }
      }
      
      // Method 2: Try mondaySDK if available
      if ((window as any).mondaySDK) {
        console.log('🔗 Using mondaySDK API');
        const result = await (window as any).mondaySDK.api(query, { variables: { boardId } });
        console.log('📦 Raw API response:', result);
        
        if (result.data && result.data.boards && result.data.boards[0]) {
          const items = result.data.boards[0].items;
          console.log(`📊 Found ${items.length} items in board ${boardId}`);
          
          const data: PivotData[] = items.map((item: any) => {
            const row: Record<string, any> = { name: item.name };
            item.column_values.forEach((col: any) => {
              row[col.title] = isNaN(Number(col.text)) ? col.text : Number(col.text);
            });
            return row;
          });
          
          console.log('✅ Successfully transformed data:', data);
          return data;
        }
      }
      
      // Method 3: Try to make a direct GraphQL call
      console.log('🔗 Trying direct GraphQL call...');
      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { boardId }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('📦 Raw API response:', result);
        
        if (result.data && result.data.boards && result.data.boards[0]) {
          const items = result.data.boards[0].items;
          console.log(`📊 Found ${items.length} items in board ${boardId}`);
          
          const data: PivotData[] = items.map((item: any) => {
            const row: Record<string, any> = { name: item.name };
            item.column_values.forEach((col: any) => {
              row[col.title] = isNaN(Number(col.text)) ? col.text : Number(col.text);
            });
            return row;
          });
          
          console.log('✅ Successfully transformed data:', data);
          return data;
        }
      }
      
      throw new Error('All Monday.com API methods failed');
      
    } catch (error) {
      console.error('❌ Error calling Monday.com API:', error);
      throw error;
    }
  } else {
    // Local development - use MCP
    console.log('🔗 Using MCP connection for local development...');
    
    const query = `
      query ($boardId: Int!) {
        boards(ids: [$boardId]) {
          items {
            name
            column_values {
              title
              text
              value
            }
          }
        }
      }
    `;

    try {
      const result = await mondayAPI().call("all_monday_api", {
        query,
        variables: JSON.stringify({ boardId }),
      });

      console.log('📦 Raw API response:', result);

      if (!result.data || !result.data.boards || !result.data.boards[0]) {
        throw new Error('Invalid response structure from Monday.com API');
      }

      const items = result.data.boards[0].items;
      console.log(`📊 Found ${items.length} items in board ${boardId}`);

      const data: PivotData[] = items.map((item: any) => {
        const row: Record<string, any> = { name: item.name };
        item.column_values.forEach((col: any) => {
          row[col.title] = isNaN(Number(col.text)) ? col.text : Number(col.text);
        });
        return row;
      });

      console.log('✅ Successfully transformed data:', data);
      return data;
    } catch (error) {
      console.error('❌ Error in MCP fetchPivotData:', error);
      throw error;
    }
  }
}

export function createPivotConfig(
  rows: string[],
  columns: string[],
  values: string[],
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max' = 'sum'
): PivotConfig {
  return {
    rows,
    columns,
    values,
    aggregation,
  };
}

export async function getPivotTableData(
  boardId: number,
  config: PivotConfig
) {
  const data = await fetchPivotData(boardId);
  const pivotResult = createPivotTable(data, config);
  return {
    data,
    pivotResult,
    config,
  };
}

// Export everything from pivot module
export * from "./pivot";
export { default as PivotTable } from "./PivotTable";

