import {
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

export type PageWidth = "narrow" | "standard" | "wide" | "full";

interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: PageWidth;
}

export function PageContainer({
  size = "standard",
  className = "",
  ...props
}: PageContainerProps) {
  return (
    <div
      className={`page-container page-container--${size} ${className}`.trim()}
      {...props}
    />
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  statusNotice?: ReactNode;
  titleId?: string;
  focusOnMount?: boolean;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  primaryAction,
  secondaryActions,
  statusNotice,
  titleId,
  focusOnMount = false,
}: PageHeaderProps) {
  const generatedID = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const id = titleId ?? generatedID;

  useEffect(() => {
    if (focusOnMount) headingRef.current?.focus();
  }, [focusOnMount]);

  return (
    <header className="page-header">
      <div className="page-header__content">
        {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
        <h1 ref={headingRef} id={id} tabIndex={focusOnMount ? -1 : undefined}>
          {title}
        </h1>
        {description !== undefined && (
          <div className="page-header__description">{description}</div>
        )}
        {statusNotice !== undefined && (
          <div className="page-header__notice">{statusNotice}</div>
        )}
      </div>
      {(primaryAction !== undefined || secondaryActions !== undefined) && (
        <div className="page-header__actions">
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </header>
  );
}
