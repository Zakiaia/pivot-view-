import React, { useState, useEffect } from 'react';
import PivotTable from '../PivotTable';
import { PivotData, PivotConfig } from '../pivot';

// Sample data for demonstration
const sampleData: PivotData[] = [
  { name: 'Project A', status: 'In Progress', owner: 'Alice', budget: 10000, quarter: 'Q1' },
  { name: 'Project B', status: 'Completed', owner: 'Bob', budget: 15000, quarter: 'Q1' },
  { name: 'Project C', status: 'In Progress', owner: 'Alice', budget: 8000, quarter: 'Q2' },
  { name: 'Project D', status: 'Pending', owner: 'Charlie', budget: 12000, quarter: 'Q2' },
  { name: 'Project E', status: 'Completed', owner: 'Bob', budget: 20000, quarter: 'Q1' },
  { name: 'Project F', status: 'In Progress', owner: 'Charlie', budget: 5000, quarter: 'Q2' },
  { name: 'Project G', status: 'Pending', owner: 'Alice', budget: 7000, quarter: 'Q3' },
  { name: 'Project H', status: 'Completed', owner: 'Bob', budget: 18000, quarter: 'Q3' },
];

const App: React.FC = () => {
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>({
    rows: ['status'],
    columns: ['owner'],
    values: ['budget'],
    aggregation: 'sum',
  });

  const [data, setData] = useState<PivotData[]>(sampleData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'sample' | 'monday'>('sample');

  // Fetch live data from Monday.com board
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        console.log('🚀 Starting Monday.com data fetch...');
        
        // Check if Monday.com SDK is available
        const isMondaySDKAvailable = typeof window !== 'undefined' && 
                                   (window as any).monday && 
                                   typeof (window as any).monday.api === 'function';
        
        console.log('🏠 Monday.com SDK available:', isMondaySDKAvailable);
        console.log('🌐 Current hostname:', window.location.hostname);
        console.log('🌐 User agent:', navigator.userAgent);
        
        if (isMondaySDKAvailable) {
          // Initialize Monday.com SDK
          await (window as any).monday.initialize({ listen: true });
          console.log('✅ Monday.com SDK initialized');
          
          // Get board context from Monday.com
          try {
            const context = await (window as any).monday.get('context');
            console.log('📋 Monday.com context:', context);
            
            let boardId = 4754725643; // Default fallback
            if (context && context.boardId) {
              boardId = parseInt(context.boardId);
              console.log('📋 Found board ID from context:', boardId);
            } else {
              console.log('📋 Using default board ID:', boardId);
            }
            
            const { fetchPivotData } = await import('../index');
            const mondayData = await fetchPivotData(boardId);
            setData(mondayData);
            setDataSource('monday');
            console.log('✅ Successfully loaded Monday.com data:', mondayData);
          } catch (contextError) {
            console.error('❌ Error getting Monday.com context:', contextError);
            throw contextError;
          }
        } else {
          // Fallback: try to use MCP or direct API
          console.log('🔄 Monday.com SDK not available, trying fallback methods...');
          const { fetchPivotData } = await import('../index');
          const mondayData = await fetchPivotData(4754725643);
          setData(mondayData);
          setDataSource('monday');
          console.log('✅ Successfully loaded Monday.com data via fallback:', mondayData);
        }
      } catch (error) {
        console.error('❌ Error fetching Monday.com data:', error);
        console.error('Error details:', error instanceof Error ? error.message : error);
        // Keep sample data if Monday.com fetch fails
        setDataSource('sample');
        console.log('🔄 Using sample data instead');
      } finally {
        setIsLoading(false);
      }
    }
    
    // Wait for Monday.com SDK to be available
    if (typeof window !== 'undefined' && (window as any).monday) {
      fetchData();
    } else {
      // Wait for SDK to load
      const checkSDK = setInterval(() => {
        if (typeof window !== 'undefined' && (window as any).monday) {
          clearInterval(checkSDK);
          fetchData();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkSDK);
        fetchData();
      }, 5000);
    }
  }, []);

  const handleConfigChange = (field: keyof PivotConfig, value: any) => {
    setPivotConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Pivot Table Demo</h1>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <label>
            <strong>Rows:</strong>
            <select 
              value={pivotConfig.rows[0]} 
              onChange={(e) => handleConfigChange('rows', [e.target.value])}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="status">Status</option>
              <option value="owner">Owner</option>
              <option value="quarter">Quarter</option>
            </select>
          </label>
        </div>
        
        <div>
          <label>
            <strong>Columns:</strong>
            <select 
              value={pivotConfig.columns[0]} 
              onChange={(e) => handleConfigChange('columns', [e.target.value])}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="owner">Owner</option>
              <option value="status">Status</option>
              <option value="quarter">Quarter</option>
            </select>
          </label>
        </div>
        
        <div>
          <label>
            <strong>Values:</strong>
            <select 
              value={pivotConfig.values[0]} 
              onChange={(e) => handleConfigChange('values', [e.target.value])}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="budget">Budget</option>
            </select>
          </label>
        </div>
        
        <div>
          <label>
            <strong>Aggregation:</strong>
            <select 
              value={pivotConfig.aggregation} 
              onChange={(e) => handleConfigChange('aggregation', e.target.value)}
              style={{ marginLeft: '10px', padding: '5px' }}
            >
              <option value="sum">Sum</option>
              <option value="count">Count</option>
              <option value="avg">Average</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
            </select>
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>
          Raw Data ({data.length} items) 
          {isLoading && <span style={{ color: '#007bff' }}> - Loading...</span>}
          {!isLoading && dataSource === 'monday' && <span style={{ color: '#28a745' }}> - Live Monday.com Data 🔴</span>}
          {!isLoading && dataSource === 'sample' && <span style={{ color: '#ffc107' }}> - Sample Data 📋</span>}
        </h3>
        <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #ddd', padding: '10px' }}>
          <pre style={{ fontSize: '12px', margin: 0 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>

      <div>
        <h3>Pivot Table</h3>
        <PivotTable 
          data={data} 
          config={pivotConfig} 
          className="my-pivot-table"
        />
      </div>

      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: dataSource === 'monday' ? '#e8f5e8' : '#fff3cd', 
        borderRadius: '5px',
        border: dataSource === 'monday' ? '1px solid #c3e6cb' : '1px solid #ffeaa7'
      }}>
        {dataSource === 'monday' ? (
          <>
            <h4>🔴 Live Monday.com Data Connected!</h4>
            <p>✅ <strong>Board ID: 4754725643</strong></p>
            <p>This pivot table is displaying live data from your Monday.com board. The data refreshes when you reload the page.</p>
          </>
        ) : (
          <>
            <h4>📋 Sample Data Mode</h4>
            <p>⚠️ <strong>Board ID: 4754725643</strong> - Connection not established</p>
            <p>Currently showing sample data. Check the browser console for connection details.</p>
            <p>🔄 Make sure your MCP connection is running: <code>npx mcp-remote https://mcp.monday.com/sse</code></p>
          </>
        )}
      </div>
    </div>
  );
};

export default App; 