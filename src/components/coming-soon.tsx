import { GlassCard } from "@/components/glass-card";

export function ComingSoon({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <GlassCard className="max-w-lg p-8 text-center">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-white/70">{copy}</p>
      </GlassCard>
    </div>
  );
}
