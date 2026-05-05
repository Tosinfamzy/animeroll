import { ListView } from '@/components/lists/ListView';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ListDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="px-6 py-8 max-w-7xl mx-auto w-full">
      <ListView listId={id} />
    </div>
  );
}
