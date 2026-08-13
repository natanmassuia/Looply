import { Link } from "react-router-dom";
import { IconChevronRight } from "./Icons";

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center">
            {item.to && !isLast ? (
              <Link to={item.to} className="text-[var(--looply-muted-foreground)] transition-colors hover:text-brand-600">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-semibold text-[var(--looply-foreground)]" : "text-[var(--looply-muted-foreground)]"}>
                {item.label}
              </span>
            )}
            {!isLast && <IconChevronRight className="mx-1.5 h-3.5 w-3.5 text-[var(--looply-border-strong)]" />}
          </span>
        );
      })}
    </nav>
  );
}
