import { Microwave } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
       <Microwave className="h-7 w-7 text-primary flex-shrink-0" />
      <h1 className="text-xl font-semibold group-data-[collapsible=icon]:hidden">
        <span className="text-primary">Lab</span>
        <span className="text-foreground">Station</span>
      </h1>
    </div>
  );
}
