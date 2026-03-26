import { requireRole } from "@/lib/auth-guard";
import { TestInterface } from "@/components/test/test-interface";

export default async function TestAttemptPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  await requireRole("STUDENT");
  const { testId } = await params;

  return <TestInterface testId={testId} />;
}
