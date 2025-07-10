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
    
  const hasMondaySDKPromise = typeof window !== 'undefined' && 
    (window as any).mondaySDKLoadPromise;
  
  console.log('🏠 Running inside Monday.com platform:', isInsideMondayPlatform);
  console.log('🏠 Monday.com SDK available:', isMondaySDKAvailable);
  console.log('🏠 Monday.com SDK promise available:', hasMondaySDKPromise);
  console.log('🌐 Current hostname:', typeof window !== 'undefined' ? window.location.hostname : 'undefined');
  console.log('🌐 Referrer:', typeof document !== 'undefined' ? document.referrer : 'undefined');
  
  // Helper function to use Monday.com SDK
  const useMondaySDK = async (boardId: number) => {
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
  };
  
  // Try to use Monday.com SDK (immediately available or via promise)
  if (isMondaySDKAvailable) {
    console.log('🎉 Monday.com SDK is available immediately!');
    return await useMondaySDK(boardId);
  } else if (hasMondaySDKPromise) {
    console.log('⏳ Waiting for Monday.com SDK to load...');
    
    try {
      // Wait for the SDK to load
      const monday = await (window as any).mondaySDKLoadPromise;
      console.log('🎉 Monday.com SDK loaded via promise!');
      return await useMondaySDK(boardId);
    } catch (error) {
      console.error('❌ Error waiting for Monday.com SDK:', error);
      // Continue to fallback approaches
    }
  }
  
     // Fallback approaches
   if (isInsideMondayPlatform) {
    // Inside Monday.com but SDK not available - try postMessage communication
    console.log('🔧 Inside Monday.com platform but SDK unavailable, trying postMessage API...');
    
         return new Promise<PivotData[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Monday.com platform response'));
      }, 10000);
      
      // Listen for messages from Monday.com platform
      const messageHandler = (event: MessageEvent) => {
        console.log('📨 Received message from Monday.com platform:', event.data);
        
        if (event.data && event.data.type === 'BOARD_DATA_RESPONSE') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          
          try {
            const items = event.data.data;
            console.log(`📊 Found ${items.length} items via postMessage`);
            
            // Transform the data to our format
            const data: PivotData[] = items.map((item: any) => {
              const row: Record<string, any> = { name: item.name };
              if (item.column_values) {
                item.column_values.forEach((col: any) => {
                  row[col.title] = isNaN(Number(col.text)) ? col.text : Number(col.text);
                });
              }
              return row;
            });
            
            console.log('✅ Successfully received data via postMessage:', data);
            resolve(data);
          } catch (error) {
            console.error('❌ Error processing postMessage data:', error);
            reject(error);
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Send request to Monday.com platform
      console.log('📡 Sending board data request to Monday.com platform...');
      
      // Try different ways to communicate with Monday.com
      if (window.parent && window.parent !== window) {
        // We're in an iframe, communicate with parent
        window.parent.postMessage({
          type: 'REQUEST_BOARD_DATA',
          boardId: boardId
        }, '*');
      }
      
      // Also try sending to the top window
      if (window.top && window.top !== window) {
        window.top.postMessage({
          type: 'REQUEST_BOARD_DATA',
          boardId: boardId
        }, '*');
      }
      
      // Try using the Monday.com SDK if it becomes available
      const checkSDK = () => {
        if ((window as any).monday && typeof (window as any).monday.api === 'function') {
          clearTimeout(timeout);
          window.removeEventListener('message', messageHandler);
          
          console.log('🎉 Monday.com SDK became available, using it directly!');
          
          // Use the SDK to get board data
          (window as any).monday.api(`query { boards(ids: ${boardId}) { items { name column_values { title text value } } } }`).then((res: any) => {
            console.log('📦 SDK API response:', res);
            
            if (res.data && res.data.boards && res.data.boards[0]) {
              const items = res.data.boards[0].items;
              const data: PivotData[] = items.map((item: any) => {
                const row: Record<string, any> = { name: item.name };
                item.column_values.forEach((col: any) => {
                  row[col.title] = isNaN(Number(col.text)) ? col.text : Number(col.text);
                });
                return row;
              });
              
              console.log('✅ Successfully got data via SDK:', data);
              resolve(data);
            } else {
              reject(new Error('No data returned from SDK'));
            }
          }).catch((error: any) => {
            console.error('❌ SDK API error:', error);
            reject(error);
          });
        } else {
          // Check again in 100ms
          setTimeout(checkSDK, 100);
        }
      };
      
      // Start checking for SDK availability
      checkSDK();
    });
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

