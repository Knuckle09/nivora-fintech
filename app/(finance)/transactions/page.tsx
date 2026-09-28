import { getFinanceData } from "@/lib/finance-data";
import { TransactionExplorer } from "@/components/transactions/explorer";

export const metadata = { title: "Transactions | Nivora" };

export default async function TransactionsPage() {
  const data = await getFinanceData();
  return <div className="dashboard-page">
    <div className="page-heading"><div><p className="eyebrow">YOUR LEDGER</p><h1>Transactions.</h1><p className="page-subtitle">A closer look at where money moves.</p></div></div>
    <TransactionExplorer transactions={data.recentTransactions} categories={data.categories} />
  </div>;
}
