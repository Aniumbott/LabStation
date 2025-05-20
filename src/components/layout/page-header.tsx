
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
    <div className="mb-6 sm:mb-8 pt-12 md:pt-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 mb-2 sm:mb-0">
          {Icon && <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-primary flex-shrink-0" />}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        </div>
        {actions && <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">{actions}</div>}
      </div>
      {description && (
        typeof description === 'string' ? (
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">{description}</p>
        ) : (
          <div className="mt-1 text-sm sm:text-base text-muted-foreground">{description}</div>
        )
      )}
    </div>
  );
}
