const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/app/allowances/page.tsx',
  'src/app/audit/page.tsx',
  'src/app/inventory/page.tsx',
  'src/app/map/page.tsx',
  'src/app/parts-requests/page.tsx',
  'src/app/service-requests/page.tsx',
  'src/app/truck-history/page.tsx'
];

for (const file of filesToFix) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already fixed
  if (content.includes('const { role, isAdmin, isLoading } = useRole()')) {
    continue;
  }

  content = content.replace(
    'const { role, isAdmin } = useRole();',
    `const { role, isAdmin, isLoading } = useRole();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }`
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed', file);
}
