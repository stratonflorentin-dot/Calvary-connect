// Supabase Connection Diagnostic
// Add this to your CEO dashboard to debug the issue

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function SupabaseDiagnostic() {
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        console.log('🔍 Starting Supabase diagnostics...');
        
        // Test 1: Check client initialization
        console.log('📋 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
        console.log('📋 Supabase client:', supabase);
        
        // Test 2: Basic connection test
        const { data, error } = await supabase
          .from('vehicles')
          .select('count')
          .single();
          
        console.log('📊 Connection test result:', { data, error });
        
        if (error) {
          setDiagnostic({
            type: 'connection_error',
            message: error.message,
            details: error
          });
        } else {
          setDiagnostic({
            type: 'success',
            message: 'Supabase connection working',
            data: data
          });
        }
        
      } catch (err) {
        console.error('💥 Diagnostic error:', err);
        setDiagnostic({
          type: 'fatal_error',
          message: err.message,
          details: err
        });
      } finally {
        setLoading(false);
      }
    };

    runDiagnostics();
  }, []);

  if (loading) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-lg font-bold mb-2">🔍 Running Diagnostics...</h3>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold mb-4">🔧 Supabase Connection Diagnostic</h2>
      
      {diagnostic && (
        <div className={`p-4 rounded-lg border ${
          diagnostic.type === 'success' ? 'bg-green-50 border-green-200' : 
          diagnostic.type === 'connection_error' ? 'bg-red-50 border-red-200' : 
          'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${
              diagnostic.type === 'success' ? 'bg-green-500' : 
              diagnostic.type === 'connection_error' ? 'bg-red-500' : 
              'bg-gray-500'
            }`}></div>
            <h3 className="text-lg font-bold">
              {diagnostic.type === 'success' ? '✅' : 
               diagnostic.type === 'connection_error' ? '❌' : '⚠️'} 
              {' ' + diagnostic.message}
            </h3>
          </div>
          
          {diagnostic.details && (
            <div className="mt-4 p-3 bg-gray-100 rounded">
              <h4 className="font-bold mb-2">Details:</h4>
              <pre className="text-xs overflow-auto bg-white p-2 rounded border">
                {JSON.stringify(diagnostic.details, null, 2)}
              </pre>
            </div>
          )}
          
          {diagnostic.data && (
            <div className="mt-4">
              <h4 className="font-bold mb-2">Data Received:</h4>
              <pre className="text-xs overflow-auto bg-white p-2 rounded border">
                {JSON.stringify(diagnostic.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
