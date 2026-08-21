import { notFound } from "next/navigation";
import WheatScene from "@/components/WheatScene";
import { STAGE_INFO } from "@/lib/rules";
import type { Stage } from "@/lib/types";

export default function ScenePreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const stages: Stage[] = [1, 2, 3, 4, 5];
  return (
    <main className="py-8">
      <h1 className="mb-4 text-xl font-bold">밀알 5단계 미리보기 (개발용)</h1>
      <div className="flex flex-col gap-6">
        {stages.map((s) => (
          <section key={s} className="card overflow-hidden">
            <WheatScene stage={s} />
            <div className="p-4">
              <p className="font-bold">
                {s}단계 · {STAGE_INFO[s].title}
              </p>
              <p className="text-sm text-[var(--muted)]">{STAGE_INFO[s].caption}</p>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
