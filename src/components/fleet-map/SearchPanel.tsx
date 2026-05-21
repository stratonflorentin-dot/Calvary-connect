import { Input } from '@/components/ui/input';
import { useContext, useMemo } from 'react';
import { FleetMapContext } from '@/context/FleetMapContext';

export function SearchPanel() {
  const { drivers } = useContext(FleetMapContext);
  const onlineCount = useMemo(
    () => drivers.filter(d => d.status === 'online').length,
    [drivers],
  );

  return (
    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur rounded-lg shadow-md p-3 w-64 space-y-2">
      <Input placeholder="Search driver…" className="w-full" />
      <div className="flex justify-between text-sm text-gray-600">
        <span>{onlineCount} Online</span>
        <span>{drivers.length} Total</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center">
          <span className="w-3 h-3 bg-green-500 rounded-full mr-1"></span>Online
        </span>
        <span className="flex items-center">
          <span className="w-3 h-3 bg-gray-400 rounded-full mr-1"></span>Offline
        </span>
      </div>
    </div>
  );
}
