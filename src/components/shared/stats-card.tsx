import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  iconBg?: string;
  iconColor?: string;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
}: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn("flex size-12 items-center justify-center rounded-xl", iconBg)}>
            <Icon className={cn("size-6", iconColor)} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
