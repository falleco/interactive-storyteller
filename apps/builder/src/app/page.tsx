import { BuilderWorkspace } from '~/components/builder-workspace';
import { getBuilderBookPayload, listBuilderBooks } from '~/lib/curated-books';

export const dynamic = 'force-dynamic';

export default async function BuilderPage() {
  const summaries = await listBuilderBooks();
  const first = summaries[0]
    ? await getBuilderBookPayload(summaries[0].id)
    : undefined;
  return (
    <BuilderWorkspace
      initialBooks={summaries}
      initialBook={first ?? undefined}
    />
  );
}
