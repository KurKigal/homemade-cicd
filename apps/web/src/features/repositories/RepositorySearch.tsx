import { Search } from "lucide-react";

interface RepositorySearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function RepositorySearch({
  value,
  onChange,
}: RepositorySearchProps) {
  return (
    <div className="relative w-full md:w-80">
      <Search
        size={17}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
      />

      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder="Search repositories..."
        className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
      />
    </div>
  );
}