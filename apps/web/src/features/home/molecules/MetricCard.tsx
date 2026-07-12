import Link from "next/link";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string;
  note: string;
  action: string;
  href?: string;
  onAction?: () => void;
};

export function MetricCard({ title, value, note, action, href, onAction }: MetricCardProps) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle as="h3" className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="text-2xl font-bold tracking-normal">{value}</div>
        <p className="text-sm text-muted-foreground">{note}</p>
        {href ? (
          <Link className={cn(buttonVariants({ variant: "outline" }), "h-8")} href={href}>
            {action}
          </Link>
        ) : (
          <Button type="button" variant="outline" onClick={onAction}>
            {action}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
