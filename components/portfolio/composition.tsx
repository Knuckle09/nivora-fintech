"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Box, CircleHelp } from "lucide-react";
import type { Account } from "@/lib/finance-types";
import { formatINR } from "@/lib/format";

const PortfolioScene = dynamic(() => import("@/components/portfolio/scene").then((module) => module.PortfolioScene), {
  ssr: false,
  loading: () => <div className="portfolio-scene-loading" role="status">Preparing the portfolio view...</div>
});

const typeLabels: Record<string, string> = { checking: "Cash", savings: "Savings", investment: "Investments" };

export function PortfolioComposition({ accounts }: { accounts: Account[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [nearView, setNearView] = useState(false);
  const totals = accounts.reduce<Record<string, number>>((result, account) => {
    if (account.balance_minor > 0 && account.account_type !== "credit") {
      result[account.account_type] = (result[account.account_type] ?? 0) + account.balance_minor;
    }
    return result;
  }, {});
  const total = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
  const assets = Object.entries(totals).filter(([, amount]) => amount > 0).map(([type, valueMinor]) => ({
    type,
    label: typeLabels[type] ?? type,
    valueMinor,
    share: total > 0 ? valueMinor / total : 0
  }));

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNearView(true);
        observer.disconnect();
      }
    }, { rootMargin: "180px" });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return <section className="portfolio-section" aria-labelledby="portfolio-title" ref={sectionRef}>
    <div className="section-heading"><div><p className="eyebrow">A SPATIAL VIEW OF YOUR ASSETS</p><h2 id="portfolio-title">Portfolio composition</h2></div><span className="portfolio-total">Assets · {formatINR(total)}</span></div>
    {assets.length ? <>
      <div className="portfolio-scene-wrap">{nearView ? <PortfolioScene assets={assets} /> : <div className="portfolio-scene-loading" role="status">Interactive allocation loads as you reach this view.</div>}</div>
      <ul className="portfolio-legend" aria-label="Asset allocation values">{assets.map((asset) => <li key={asset.type}><span className={`portfolio-swatch swatch-${asset.type}`} /><span className="portfolio-legend-name">{asset.label}</span><strong>{formatINR(asset.valueMinor)}</strong><span className="portfolio-share">{Math.round(asset.share * 100)}%</span></li>)}</ul>
      <p className="portfolio-note"><CircleHelp size={13} aria-hidden="true" />Boxes are sized by account balance. Credit liabilities are excluded from this asset allocation.</p>
    </> : <div className="portfolio-empty"><Box size={17} aria-hidden="true" /><span>Add a positive cash, savings, or investment balance to see its composition.</span></div>}
  </section>;
}
