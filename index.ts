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
  
  // Check if we're running inside Monday.com environment
  const isInsideMondayPlatform = typeof window !== 'undefined' && (
    window.location.hostname.includes('monday.com') ||
    window.location.hostname.includes('mondayapps.com') ||
    window.location.href.includes('monday.com') ||
    document.referrer.includes('monday.com') ||
    window.parent !== window // Running in iframe
  );
  
  // Check if Monday.com SDK is available
  const isMondaySDKAvailable = typeof window !== 'undefined' && 
    (window as any).monday && 
    typeof (window as any).monday.api === 'function';
  
  console.log('🏠 Running inside Monday.com platform:', isInsideMondayPlatform);
  console.log('🏠 Monday.com SDK available:', isMondaySDKAvailable);
  console.log('🌐 Current hostname:', typeof window !== 'undefined' ? window.location.hostname : 'undefined');
  console.log('🌐 Referrer:', typeof document !== 'undefined' ? document.referrer : 'undefined');
  
  if (isMondaySDKAvailable) {
    console.log('🔧 Using Monday.com SDK API...');
    
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
      console.log('🔗 Using Monday.com SDK API');
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
      } else {
        throw new Error('No data returned from Monday.com API');
      }
      
    } catch (error) {
      console.error('❌ Error calling Monday.com SDK API:', error);
      throw error;
    }
  } else if (isInsideMondayPlatform) {
    // Inside Monday.com but SDK not available - try session token from URL
    console.log('🔧 Inside Monday.com platform but SDK unavailable, trying session token API...');
    
    // Get session token from URL or window context
    let sessionToken: string | null = null;
    
    try {
      // Try to get from window context first
      if ((window as any).mondayContext && (window as any).mondayContext.sessionToken) {
        sessionToken = (window as any).mondayContext.sessionToken;
        console.log('🔑 Using session token from window context');
      } else {
        // Extract from URL
        const urlParams = new URLSearchParams(window.location.search);
        sessionToken = urlParams.get('sessionToken');
        console.log('🔑 Using session token from URL params');
      }
      
      if (!sessionToken) {
        throw new Error('No session token available');
      }
      
      console.log('🎫 Session token found:', sessionToken.substring(0, 20) + '...');
      
    } catch (tokenError) {
      console.error('❌ Error getting session token:', tokenError);
      throw new Error('Could not extract session token from Monday.com context');
    }
    
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
      // Use session token for authentication
      const response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'monday-client-id': 'pivot-table-app',
        },
        body: JSON.stringify({
          query,
          variables: { boardId }
        })
      });
      
      console.log('📡 API Response status:', response.status);
      console.log('📡 API Response headers:', Object.fromEntries(response.headers.entries()));
      
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
          
          console.log('✅ Successfully transformed data via session token API:', data);
          return data;
        } else if (result.errors) {
          console.error('❌ GraphQL errors:', result.errors);
          throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
        } else {
          throw new Error('No data returned from session token API call');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Session token API call failed:', response.status, errorText);
        throw new Error(`Session token API call failed: ${response.status} - ${errorText}`);
      }
      
    } catch (error) {
      console.error('❌ Error with session token API call:', error);
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

