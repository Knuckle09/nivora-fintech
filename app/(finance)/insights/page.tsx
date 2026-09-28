import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumnIncreasing, CircleHelp, MoveRight, Sparkles } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { getInsightsData } from "@/lib/insights";
import { formatDate, formatINR } from "@/lib/format";

export const metadata: Metadata = { title: "Insights | Nivora" };

export default async function InsightsPage() {
  if (!hasSupabasePublicEnv()) redirect("/login");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const insights = await getInsightsData(supabase, user.id);
  const maximumSpend = Math.max(...insights.monthTrend.map((item) => item.spendMinor), 1);

  return <div className="dashboard-page">
    <div className="page-heading"><div><p className="eyebrow">PATTERNS, WITH THEIR METHOD ATTACHED</p><h1>Signals, not guesses.</h1><p className="page-subtitle">Simple comparisons across your recorded activity.</p></div><span className="method-badge"><ChartNoAxesColumnIncreasing size={14} aria-hidden="true" />RULE-BASED</span></div>

    {!insights.historyComplete ? <section className="insight-empty" role="status"><span className="empty-mark"><CircleHelp size={19} aria-hidden="true" /></span><div><h2>Signals paused to protect accuracy.</h2><p>The six-month scan reached its 11,000-row limit. Nivora hides comparisons and projections rather than calculate them from partial history.</p></div></section> : !insights.hasHistory ? <section className="insight-empty"><span className="empty-mark"><Sparkles size={19} aria-hidden="true" /></span><div><h2>Your first signal needs a little history.</h2><p>Add transactions or seed the workspace to see category comparisons and spending pace.</p></div></section> : <>
      <section className="insight-trend-panel" aria-labelledby="trend-title">
        <div className="section-heading"><div><p className="eyebrow">MONTHLY OUTFLOW</p><h2 id="trend-title">Spending over time</h2></div><span className="trend-caption">Recorded expenses only</span></div>
        <div className="trend-chart" role="img" aria-label={`Monthly spending: ${insights.monthTrend.map((month) => `${month.month}, ${formatINR(month.spendMinor)}`).join("; ")}`}>
          {insights.monthTrend.map((month) => <div className={`trend-column${month.current ? " trend-current" : ""}`} key={month.month} aria-hidden="true"><span className="trend-value">{formatINR(month.spendMinor, true)}</span><div className="trend-track"><span style={{ height: `${Math.max((month.spendMinor / maximumSpend) * 100, month.spendMinor ? 4 : 0)}%` }} /></div><span className="trend-month">{month.month.split(" ")[0]}</span></div>)}
        </div>
      </section>

      <div className="insight-columns">
        <section className="insight-panel" aria-labelledby="category-signal-title">
          <div className="section-heading"><div><p className="eyebrow">CATEGORY MOVEMENT</p><h2 id="category-signal-title">Worth a closer look</h2></div></div>
          <p className="panel-intro">{insights.latestCompleteMonth} compared with the previous three complete months.</p>
          {insights.categoryChanges.length ? <div className="insight-list">{insights.categoryChanges.map((insight) => <article className="insight-row" key={insight.categoryId}><span className={`insight-direction${insight.direction === "up" ? " direction-up" : " direction-down"}`}>{insight.direction === "up" ? <ArrowUpRight size={17} aria-hidden="true" /> : <ArrowDownRight size={17} aria-hidden="true" />}</span><div className="insight-copy"><strong>{insight.name}</strong><span>{insight.direction === "up" ? "Above" : "Below"} the trailing average</span></div><div className="insight-values"><strong>{insight.direction === "up" ? "+" : "−"}{insight.changePercent}%</strong><span>{formatINR(insight.latestSpend)}</span></div></article>)}</div> : <div className="insight-subempty">No category crossed the comparison threshold this month.</div>}
          <p className="method-note"><CircleHelp size={14} aria-hidden="true" />{insights.trendRule}</p>
        </section>

        <section className="insight-panel" aria-labelledby="outlier-title">
          <div className="section-heading"><div><p className="eyebrow">LARGER PURCHASES</p><h2 id="outlier-title">Unusually large</h2></div></div>
          <p className="panel-intro">Expenses in {insights.latestCompleteMonth} that stand out against category history.</p>
          {insights.unusualTransactions.length ? <div className="insight-list">{insights.unusualTransactions.map((transaction) => <article className="insight-row" key={`${transaction.occurredOn}-${transaction.merchant}`}><span className="outlier-mark" aria-hidden="true"><Sparkles size={15} /></span><div className="insight-copy"><strong>{transaction.merchant}</strong><span>{transaction.category} · {formatDate(transaction.occurredOn)}</span></div><div className="insight-values"><strong>{formatINR(transaction.amountMinor)}</strong><span>category median {formatINR(transaction.medianMinor)}</span></div></article>)}</div> : <div className="insight-subempty">No recorded expense crossed the unusually large threshold.</div>}
          <p className="method-note"><CircleHelp size={14} aria-hidden="true" />{insights.outlierRule}</p>
        </section>
      </div>

      <section className="projection-panel" aria-labelledby="projection-title">
        <div className="projection-copy"><p className="eyebrow">CURRENT-MONTH PACE</p><h2 id="projection-title">A straight-line month-end view.</h2><p>Extends the current daily net cashflow across the remaining days. It is a pace calculation, not a forecast of future bills or income.</p></div>
        <div className="projection-values"><div><span>Today</span><strong>{formatINR(insights.totalBalance)}</strong></div><MoveRight size={18} aria-hidden="true" /><div><span>Month-end at this pace</span><strong>{formatINR(insights.projectedBalance)}</strong></div></div>
      </section>
    </>}
  </div>;
}
