# Devin Quick Start Guide: API Anything Integration

## Immediate Start (Run These Commands)

```bash
# 1. Navigate to API Anything repo
cd D:\my projects\fleet management\temp-api-anything

# 2. Install dependencies and CLI globally
npm ci && npm install -g "$(npm pack --silent)"

# 3. Verify installation works
api-anything call hacker-news search query=sqlite

# 4. List all available operations
api-anything ops

# 4. Connect MCP server (run in your main agent)
# claude mcp add --scope user api-anything -- api-anything mcp
```

## First Exploration (Run These to Understand the System)

```bash
# List all sites
api-anything ops

# Test a few operations
api-anything call hacker-news search query=logistics
api-anything call google-flights search origin=JFK destination=LAX date=2024-12-25
api-anything call goodreads searchBooks q=supply chain

# See operation details
api-anything ops google-flights
api-anything ops goodreads
```

## Create Your First Custom Operation (Tanzania Ports Authority)

```bash
# 1. Scout the site first
api-anything capture --outline https://www.tpa.go.tz/vessel-schedule

# 2. Add operation with two examples
api-anything add tpa vessel_schedule \
  --trigger 'https://www.tpa.go.tz/vessel-schedule?date={date}' \
  --example date=2024-12-01 --example2 date=2024-12-02 \
  --match 'table.vessel-schedule' \
  --html '{"vessels":"tbody tr","fields":{"vessel":".vessel-name","eta":".eta","berth":".berth","status":".status"}}'

# 3. Test it
api-anything call tpa vessel_schedule date=2024-12-15
```

## Key Files to Understand

| File | Purpose |
|------|---------|
| `skills/api-anything/SKILL.md` | How to teach new sites |
| `docs/REFERENCE.md` | Complete reference |
| `docs/QUICKSTART.md` | Quick setup |
| `bench/README.md` | Benchmark methodology |
| `src/learn.ts` | Core learning logic |
| `src/execute.ts` | Operation execution |

## Integration Points for Calvary Connect

### 1. External API Service (`src/lib/external-apis.ts`)
```typescript
// Wrapper around api-anything CLI/MCP
export async function callExternalApi(site: string, operation: string, params: Record<string, any>) {
  // Use MCP or CLI to call operation
  // Cache response in Redis
  // Return typed response
}
```

### 2. API Routes to Create
```
src/app/api/external/
├── tpa/vessel-schedule/route.ts
├── tra/customs-status/route.ts
├── sendy/quote/route.ts
├── fuel/prices/route.ts
├── border/wait-times/route.ts
└── sgr/schedules/route.ts
```

### 3. Map Components
```tsx
// components/external-apis/FuelPriceMap.tsx
// components/external-apis/BorderWaitTimes.tsx
// components/external-apis/PortCongestion.tsx
```

## Testing Checklist

- [ ] Each operation returns valid JSON
- [ ] Tier 1 (plain HTTP) works for most calls
- [ ] Browser fallback works when needed
- [ ] Repair mechanism triggers on schema changes
- [ ] Auth tokens refresh automatically
- [ ] Rate limits respected
- [ ] Cache invalidation works

## Common Patterns

### Adding a Site with Login (e.g., LinkedIn, Sendy)
```bash
api-anything login sendy
# Imports cookies from your browser profile
# Or opens Chrome window for manual login
```

### Repairing a Broken Operation
```bash
# When a call fails with class: "replay"
api-anything repair <site> <operation>
# Re-learns and saves new version after successful replay
```

### Using MCP in Your Agent
```json
// .mcp.json
{
  "mcpServers": {
    "api-anything": {
      "command": "api-anything",
      "args": ["mcp"]
    }
  }
}
```

Then in your agent:
```
"Call the tpa vessel_schedule operation for date 2024-12-15"
```

## Next Steps for Devin

1. **Run the install commands above** - verify everything works
2. **Explore all 22 existing operations** - understand the patterns
3. **Pick 3 priority Tanzanian sites** - start with TPA, TRA, Sendy
3. **Create operations** using the skill methodology
4. **Build the service layer** in Calvary Connect
5. **Integrate into map/dashboard** - show real data

## Support Resources

- **API Anything Issues**: https://github.com/goodnight000/api-anything/issues
- **Calvary Connect Codebase**: `D:\my projects\fleet management\src\`
- **Existing API Gateway**: `src\lib\api-gateway.ts`
- **Event Stream**: `src\lib\event-stream.ts` (for real-time updates)

---

**Start with the install commands above. Report back with the output of `api-anything ops` and we'll plan the first 3 custom operations together.**