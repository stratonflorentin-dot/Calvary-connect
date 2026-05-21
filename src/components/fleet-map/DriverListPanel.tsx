import { useContext, useState } from 'react';
import { FleetMapContext } from '@/context/FleetMapContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronUp, ChevronDown } from 'lucide-react';

export function DriverListPanel() {
  const { drivers, selectedId, setSelectedId } = useContext(FleetMapContext);
  const [open, setOpen] = useState(true);

  return (
    <motion.div
      className="absolute bottom-4 left-4 w-72 bg-white/95 backdrop-blur rounded-xl shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-2"
      >
        <span className="font-medium">Fleet ({drivers.length})</span>
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      <AnimatePresence>
        {open && (
          <ScrollArea className="h-60 p-2">
            {drivers.map(d => (
              <div
                key={d.id}
                className={`flex items-center justify-between p-2 rounded-md cursor-pointer ${d.id === selectedId ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50'}`}
                onClick={() => setSelectedId(d.id)}
              >
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-gray-500">{d.vehicle_type}</p>
                </div>
                <Badge variant="outline">{d.speed} km/h</Badge>
              </div>
            ))}
          </ScrollArea>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
