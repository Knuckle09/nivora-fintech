export type AccountType = "checking" | "savings" | "investment" | "credit";
export type TransactionType = "income" | "expense" | "transfer";

export type Account = {
  id: string;
  name: string;
  account_type: AccountType;
  institution: string;
  currency: "INR";
  color: string;
  last_four: string | null;
  sort_order: number;
  opening_balance_minor: number;
  balance_minor: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  kind: "income" | "expense";
  color: string;
  icon: string;
};

export type Transaction = {
  id: string;
  account_id: string;
  category_id: string | null;
  merchant: string;
  description: string;
  amount_minor: number;
  transaction_type: TransactionType;
  occurred_on: string;
  account: Pick<Account, "name" | "account_type" | "color"> | null;
  category: Pick<Category, "name" | "slug" | "color"> | null;
};
