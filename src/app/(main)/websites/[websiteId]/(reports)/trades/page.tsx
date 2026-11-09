import type { Metadata } from 'next';
import { TradesPage } from './TradesPage';

export default async function ({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;

  return <TradesPage websiteId={websiteId} />;
}

export const metadata: Metadata = {
  title: 'Trades',
};
