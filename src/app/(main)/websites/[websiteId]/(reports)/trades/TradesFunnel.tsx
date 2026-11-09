import { Box, Column, Grid, Heading, ProgressBar, Row, Text } from '@umami/react-zen';
import { useMemo } from 'react';
import { Panel } from '@/components/common/Panel';
import { ListTable } from '@/components/metrics/ListTable';
import { MetricCard } from '@/components/metrics/MetricCard';
import { MetricsBar } from '@/components/metrics/MetricsBar';
import { formatLongNumber } from '@/lib/format';
import { TRADE_ABANDON_MINUTES, type TradeEvent } from '@/lib/trades';
import {
  getTradeFunnel,
  type TradeFunnelStage,
  type TradeOutcomeCategory,
} from '@/lib/trades-funnel';

const STAGES: Record<TradeFunnelStage, { label: string; waiting?: string; gone?: string }> = {
  started: { label: 'Started (pressed Buy/Sell)' },
  estimated: { label: 'Got an estimate', waiting: 'in progress', gone: 'abandoned' },
  sent: { label: 'Sent to market', waiting: 'in progress', gone: 'abandoned' },
  filled: { label: 'Filled, fully or partly', waiting: 'still open', gone: 'not filled' },
};

const OUTCOMES: Record<TradeOutcomeCategory, string> = {
  filled: 'Filled',
  partiallyFilled: 'Partly filled, then cancelled or expired',
  cancelled: 'Cancelled',
  expired: 'Expired',
  rejected: 'Rejected',
  failed: 'Failed',
  open: 'Still open',
};

export function TradesFunnel({ events }: { events: TradeEvent[] }) {
  const funnel = useMemo(() => getTradeFunnel(events), [events]);
  const started = funnel.stages[0].trades;
  const sent = funnel.stages.find(s => s.stage === 'sent')?.trades ?? 0;
  const outcomeTotal = funnel.outcomes.reduce((sum, o) => sum + o.trades, 0);

  return (
    <Column gap>
      <Heading size="2xl">Funnel</Heading>
      <MetricsBar>
        <MetricCard label="Trades started" value={started} formatValue={formatLongNumber} />
        <MetricCard
          label="Sent to market"
          value={started ? (sent / started) * 100 : 0}
          formatValue={n => `${Math.round(n)}%`}
        />
        <MetricCard
          label="Median time to send"
          value={funnel.medianMinutesToSend ?? 0}
          formatValue={n => `${n.toFixed(1)} min`}
        />
        <MetricCard
          label="Estimates per sent trade"
          value={funnel.estimatesPerSentTrade ?? 0}
          formatValue={n => n.toFixed(2)}
        />
      </MetricsBar>
      <Grid columns={{ base: '1fr', lg: '3fr 2fr' }} gap>
        <Panel>
          <Column gap="6">
            {funnel.stages.map(({ stage, trades, dropped, waiting }, index) => {
              const { label, waiting: waitingLabel, gone } = STAGES[stage];
              const previous = index ? funnel.stages[index - 1].trades : trades;

              return (
                <Grid key={stage} columns="auto 1fr" gap="6">
                  <Column alignItems="center" position="relative">
                    <Row
                      borderRadius="full"
                      backgroundColor="surface-sunken"
                      width="40px"
                      height="40px"
                      justifyContent="center"
                      alignItems="center"
                      style={{ zIndex: 1 }}
                    >
                      <Text weight="bold">{index + 1}</Text>
                    </Row>
                    {index > 0 && (
                      <Box
                        position="absolute"
                        backgroundColor="surface-sunken"
                        width="2px"
                        height="120px"
                        top="-100%"
                      />
                    )}
                  </Column>
                  <Column gap="2">
                    <Row justifyContent="space-between" gap>
                      <Text weight="bold">{label}</Text>
                      <Text>{formatLongNumber(trades)} trades</Text>
                    </Row>
                    <Row alignItems="center" gap="6">
                      <ProgressBar
                        value={trades}
                        min={0}
                        max={previous || 1}
                        style={{ width: '100%' }}
                      />
                      <Row minWidth="70px" justifyContent="end">
                        <Text weight="bold" size="2xl">
                          {started ? Math.round((trades / started) * 100) : 0}%
                        </Text>
                      </Row>
                    </Row>
                    {dropped > 0 && (
                      <Text color="muted" size="sm">
                        {formatLongNumber(dropped)} dropped: {formatLongNumber(dropped - waiting)}{' '}
                        {gone}
                        {waiting > 0 && `, ${formatLongNumber(waiting)} ${waitingLabel}`}
                      </Text>
                    )}
                  </Column>
                </Grid>
              );
            })}
            <Text color="muted" size="sm">
              Abandoned means no activity for {TRADE_ABANDON_MINUTES} minutes before being sent.
              Only trades started in the app are included.
            </Text>
          </Column>
        </Panel>
        <Panel>
          <Heading size="lg">Outcome of sent trades</Heading>
          <ListTable
            title="Outcome"
            metric="Trades"
            animate={false}
            data={funnel.outcomes.map(o => ({
              label: OUTCOMES[o.outcome],
              count: o.trades,
              percent: outcomeTotal ? (o.trades / outcomeTotal) * 100 : 0,
            }))}
          />
        </Panel>
      </Grid>
    </Column>
  );
}
