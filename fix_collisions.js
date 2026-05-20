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

  // Replace isLoading collision
  content = content.replace(
    'const { role, isAdmin, isLoading } = useRole();',
    'const { role, isAdmin, isLoading: roleLoading } = useRole();'
  );

  content = content.replace(
    '  if (isLoading) {',
    '  if (roleLoading) {'
  );

  fs.writeFileSync(filePath, content);
  console.log('Fixed collisions in', file);
}
