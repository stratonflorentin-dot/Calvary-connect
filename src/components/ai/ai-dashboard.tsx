"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Loader2,
  CheckCircle2,
  ListChecks,
} from "lucide-react";

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("[")))
    return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeAIOutput(raw: unknown) {
  const insights: string[] = [];
  const recommendations: string[] = [];
  const risks: string[] = [];
  const summary: string[] = [];

  const addUnique = (target: string[], value: unknown) => {
    if (value === null || value === undefined) return;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const clean = text.replace(/^[-•\s]+/, "").trim();
    if (clean && !target.includes(clean)) target.push(clean);
  };

  const walk = (
    value: unknown,
    preferredSection?: "insights" | "recommendations" | "risks" | "summary",
  ) => {
    const parsed = tryParseJson(value);

    if (typeof parsed === "string") {
      addUnique(
        preferredSection === "recommendations"
          ? recommendations
          : preferredSection === "risks"
            ? risks
            : preferredSection === "summary"
              ? summary
              : insights,
        parsed,
      );
      return;
    }

    if (Array.isArray(parsed)) {
      parsed.forEach((item) => walk(item, preferredSection));
      return;
    }

    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;

      Object.entries(obj).forEach(([key, value]) => {
        const normalizedKey = key.toLowerCase();
        if (normalizedKey.includes("recommend")) walk(value, "recommendations");
        else if (normalizedKey.includes("risk")) walk(value, "risks");
        else if (normalizedKey.includes("insight")) walk(value, "insights");
        else if (
          normalizedKey.includes("summary") ||
          normalizedKey.includes("forecast")
        )
          walk(value, "summary");
        else if (
          normalizedKey === "analysis" ||
          normalizedKey === "text" ||
          normalizedKey === "content"
        )
          walk(value);
      });
    }
  };

  walk(raw);

  return {
    summary: summary.slice(0, 5),
    insights: insights.slice(0, 8),
    recommendations: recommendations.slice(0, 8),
    risks: risks.slice(0, 8),
  };
}

function ReadableAIResult({
  title,
  data,
  tone,
}: {
  title: string;
  data: unknown;
  tone: "blue" | "purple";
}) {
  const result = normalizeAIOutput(data);
  const styles =
    tone === "purple"
      ? "mt-4 rounded-xl border p-4 bg-purple-50 border-purple-200 space-y-4"
      : "mt-4 rounded-xl border p-4 bg-blue-50 border-blue-200 space-y-4";
  const titleStyle =
    tone === "purple"
      ? "text-sm text-purple-700 font-semibold"
      : "text-sm text-blue-700 font-semibold";

  return (
    <div className={styles}>
      <p className={titleStyle}>{title}</p>

      {result.summary.length > 0 && (
        <div className="rounded-lg bg-white p-3 border">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Brain className="w-4 h-4" /> Summary
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            {result.summary.map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {result.insights.length > 0 && (
        <div className="rounded-lg bg-white p-3 border">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" /> Key Insights
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            {result.insights.map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div className="rounded-lg bg-white p-3 border">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-green-600" /> Recommended
            Actions
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            {result.recommendations.map((item, index) => (
              <li key={index} className="flex gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.risks.length > 0 && (
        <div className="rounded-lg bg-white p-3 border">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Risks / Data
            Quality Issues
          </p>
          <ul className="space-y-2 text-sm text-slate-700">
            {result.risks.map((item, index) => (
              <li key={index}>• {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AIDashboard() {
  const [forecastType, setForecastType] = useState("revenue");
  const [timeframe, setTimeframe] = useState("month");
  const [analysisType, setAnalysisType] = useState("performance");
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleForecast = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: forecastType, timeframe }),
      });
      const data = await response.json();
      setForecast(data.forecast);
    } catch (error) {
      console.error("Forecast error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: analysisType }),
      });
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold">AI-Powered Insights</h2>
        <Badge variant="outline" className="ml-2">
          NVIDIA Nemotron
        </Badge>
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
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                "Generate Forecast"
              )}
            </Button>
          </div>

          {forecast && (
            <ReadableAIResult
              title="AI Forecast Results"
              data={forecast}
              tone="purple"
            />
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
                <SelectItem value="cost_optimization">
                  Cost Optimization
                </SelectItem>
                <SelectItem value="profitability">Profitability</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                "Analyze"
              )}
            </Button>
          </div>

          {analysis && (
            <ReadableAIResult
              title="AI Analysis Results"
              data={analysis}
              tone="blue"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
