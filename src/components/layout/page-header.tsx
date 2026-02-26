
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string | ReactNode;
  description?: string | ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 border-b border-border pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 mb-1.5 sm:mb-0">
          {Icon && <Icon className="h-6 w-6 text-primary flex-shrink-0" />}
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        {actions && <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {description && (
        typeof description === 'string' ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : (
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        )
      )}
    </div>
  );
}
