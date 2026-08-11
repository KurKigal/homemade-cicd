import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Loader2,
  XCircle,
} from "lucide-react";

interface RunStatusBadgeProps {
  status: string;
  conclusion: string | null;
}

export function RunStatusBadge({
  status,
  conclusion,
}: RunStatusBadgeProps) {
  if (status !== "completed") {
    if (status === "in_progress") {
      return (
        <Badge
          icon={
            <Loader2
              size={14}
              className="animate-spin"
            />
          }
          label="Running"
          className="text-blue-300"
        />
      );
    }

    return (
      <Badge
        icon={<Clock3 size={14} />}
        label={status}
        className="text-amber-300"
      />
    );
  }

  if (conclusion === "success") {
    return (
      <Badge
        icon={
          <CheckCircle2 size={14} />
        }
        label="Passed"
        className="text-emerald-300"
      />
    );
  }

  if (conclusion === "failure") {
    return (
      <Badge
        icon={<XCircle size={14} />}
        label="Failed"
        className="text-red-300"
      />
    );
  }

  return (
    <Badge
      icon={<CircleDashed size={14} />}
      label={conclusion ?? "Completed"}
      className="text-zinc-400"
    />
  );
}

function Badge({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}