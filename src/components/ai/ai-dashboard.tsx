"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Loader2 } from 'lucide-react';

export function AIDashboard() {
  const [forecastType, setForecastType] = useState('revenue');
  const [timeframe, setTimeframe] = useState('month');
  const [analysisType, setAnalysisType] = useState('performance');
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleForecast = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: forecastType, timeframe })
      });
      const data = await response.json();
      setForecast(data.forecast);
    } catch (error) {
      console.error('Forecast error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: analysisType })
      });
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold">AI-Powered Insights</h2>
        <Badge variant="outline" className="ml-2">NVIDIA Nemotron</Badge>
      </div>

      {/* Forecast Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue & Expense Forecasting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={forecastType} onValueChange={setForecastType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expenses">Expenses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleForecast} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Generate Forecast'}
            </Button>
          </div>

          {forecast && (
            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-700 font-medium mb-2">AI Forecast Results</p>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(forecast, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Fleet Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="cost_optimization">Cost Optimization</SelectItem>
                <SelectItem value="profitability">Profitability</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Analyze'}
            </Button>
          </div>

          {analysis && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700 font-medium mb-2">AI Analysis Results</p>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(analysis, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
