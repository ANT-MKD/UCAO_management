import { cn, getInitials, hashColor } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  src?: string;
  className?: string;
}

const SIZE_MAP = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
};

export function UserAvatar({ name, size = "md", src, className }: UserAvatarProps) {
  const initials = getInitials(name);
  const bg = hashColor(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover flex-shrink-0", SIZE_MAP[size], className)}
      />
    );
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0", SIZE_MAP[size], className)}
      style={{ backgroundColor: bg }}
      title={name}
      data-testid={`avatar-${name}`}
    >
      {initials}
    </div>
  );
}
