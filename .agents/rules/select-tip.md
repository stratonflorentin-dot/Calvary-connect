---
trigger: always_on
---

# UI Guidelines & Tips

- A `<SelectItem />` (or `<Select.Item />`) must always have a `value` prop that is not an empty string (`""`). 
- When we want to represent a placeholder or an empty state, the Select value itself should be set to an empty string (`""`) to show the trigger's placeholder. If you set a `<SelectItem value="" />`, Radix UI / Shadcn cannot resolve it correctly because it conflicts with the empty-string state used to clear selection.
- Use non-empty fallback values like `"none"`, `"no_records"`, `"all"`, or simply let the Select placeholder handle the empty/unselected state.
