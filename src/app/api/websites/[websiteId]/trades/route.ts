import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { withDateRange } from '@/lib/schema';
import { canViewWebsite } from '@/permissions';
import { getTradeEvents } from '@/queries/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ websiteId: string }> },
) {
  const { auth, query, error } = await parseRequest(request, withDateRange());

  if (error) {
    return error();
  }

  const { websiteId } = await params;

  if (!(await canViewWebsite(auth, websiteId))) {
    return unauthorized();
  }

  const { startDate, endDate } = await getQueryFilters(query, websiteId);

  return json({ events: await getTradeEvents(websiteId, startDate, endDate) });
}
