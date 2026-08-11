import { useTheme } from "../theme/ThemeProvider";

interface BrandProps {
  placement: "header" | "login";
}

export function AtlasBrand({ placement }: BrandProps) {
  const { resolvedTheme } = useTheme();
  const suffix = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <span
      className={`atlas-brand atlas-brand--${placement}`}
      aria-hidden="true"
    >
      <img
        className="atlas-brand__lockup"
        src={`/branding/atlas-dns-lockup-${suffix}.svg`}
        alt=""
        width="800"
        height="300"
      />
      {placement === "header" && (
        <img
          className="atlas-brand__mark"
          src={`/branding/atlas-mark-color-${suffix}.svg`}
          alt=""
          width="1024"
          height="1024"
        />
      )}
    </span>
  );
}
