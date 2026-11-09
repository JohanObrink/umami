import { Box, Column, Grid, Heading, ProgressBar, Row, Text } from '@umami/react-zen';
import { useMemo } from 'react';
import { Panel } from '@/components/common/Panel';
import { useMessages } from '@/components/hooks';
import { labels, messages } from '@/components/messages';
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
  started: { label: labels.tradeStageStarted },
  estimated: {
    label: labels.tradeStageEstimated,
    waiting: messages.tradesInProgress,
    gone: messages.tradesAbandoned,
  },
  sent: {
    label: labels.tradeStageSent,
    waiting: messages.tradesInProgress,
    gone: messages.tradesAbandoned,
  },
  filled: {
    label: labels.tradeStageFilled,
    waiting: messages.tradesStillOpen,
    gone: messages.tradesNotFilled,
  },
};

const OUTCOMES: Record<TradeOutcomeCategory, string> = {
  filled: labels.tradeOutcomeFilled,
  partiallyFilled: labels.tradeOutcomePartiallyFilled,
  cancelled: labels.tradeOutcomeCancelled,
  expired: labels.tradeOutcomeExpired,
  rejected: labels.tradeOutcomeRejected,
  failed: labels.tradeOutcomeFailed,
  open: labels.tradeOutcomeOpen,
};

export function TradesFunnel({ events }: { events: TradeEvent[] }) {
  const { t } = useMessages();
  const funnel = useMemo(() => getTradeFunnel(events), [events]);
  const started = funnel.stages[0].trades;
  const sent = funnel.stages.find(s => s.stage === 'sent')?.trades ?? 0;
  const outcomeTotal = funnel.outcomes.reduce((sum, o) => sum + o.trades, 0);

  return (
    <Column gap>
      <Heading size="2xl">{t(labels.funnel)}</Heading>
      <MetricsBar>
        <MetricCard
          label={t(labels.tradesStarted)}
          value={started}
          formatValue={formatLongNumber}
        />
        <MetricCard
          label={t(labels.sentToMarket)}
          value={started ? (sent / started) * 100 : 0}
          formatValue={n => `${Math.round(n)}%`}
        />
        <MetricCard
          label={t(labels.medianTimeToSend)}
          value={funnel.medianMinutesToSend ?? 0}
          formatValue={n => t(messages.minutesShort, { x: n.toFixed(1) })}
        />
        <MetricCard
          label={t(labels.estimatesPerSentTrade)}
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
                      <Text weight="bold">{t(label)}</Text>
                      <Text>{t(messages.tradeCount, { count: formatLongNumber(trades) })}</Text>
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
                        {t(messages.tradesDropped, {
                          dropped: formatLongNumber(dropped),
                          gone: [
                            t(gone, { count: formatLongNumber(dropped - waiting) }),
                            waiting > 0 && t(waitingLabel, { count: formatLongNumber(waiting) }),
                          ]
                            .filter(Boolean)
                            .join(', '),
                        })}
                      </Text>
                    )}
                  </Column>
                </Grid>
              );
            })}
            <Text color="muted" size="sm">
              {t(messages.tradesFunnelNote, { minutes: TRADE_ABANDON_MINUTES })}
            </Text>
          </Column>
        </Panel>
        <Panel>
          <Heading size="lg">{t(labels.outcomeOfSentTrades)}</Heading>
          <ListTable
            title={t(labels.outcome)}
            metric={t(labels.trades)}
            animate={false}
            data={funnel.outcomes.map(o => ({
              label: t(OUTCOMES[o.outcome]),
              count: o.trades,
              percent: outcomeTotal ? (o.trades / outcomeTotal) * 100 : 0,
            }))}
          />
        </Panel>
      </Grid>
    </Column>
  );
}
