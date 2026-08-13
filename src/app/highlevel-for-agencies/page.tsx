import type { Metadata } from "next";
import { ArrowRight, Check, CircleDollarSign, ShieldCheck } from "lucide-react";
import {
  affiliateUrl,
  parseAffiliateSubId,
  type AffiliateDestination,
  type AffiliateSubId
} from "@/lib/affiliate/links";

export const metadata: Metadata = {
  title: "HighLevel for Agencies | PayMatch",
  description: "A practical comparison of HighLevel plans for agencies, including setup and billing considerations."
};

type SearchParams = Record<string, string | string[] | undefined>;

const plans: Array<{
  destination: AffiliateDestination;
  name: string;
  price: string;
  bestFor: string;
  features: string[];
}> = [
  {
    destination: "starter",
    name: "Starter",
    price: "$97/month",
    bestFor: "A small agency validating its first client workflows.",
    features: ["Up to three sub-accounts", "Core CRM and automation tools", "A low-commitment starting point"]
  },
  {
    destination: "unlimited",
    name: "Unlimited",
    price: "$297/month",
    bestFor: "An established agency adding clients and internal automation.",
    features: ["Unlimited sub-accounts", "Basic API access", "Branded desktop application"]
  },
  {
    destination: "pro",
    name: "Agency Pro",
    price: "$497/month",
    bestFor: "An agency selling software access as part of its offer.",
    features: ["SaaS mode", "Advanced API access", "Automated client rebilling tools"]
  }
];

export default async function HighLevelForAgenciesPage({
  searchParams
}: { searchParams?: Promise<SearchParams> | SearchParams } = {}) {
  const params = searchParams ? await searchParams : {};
  const isInstalledCustomer = Boolean(firstParam(params.session));
  const source = parseAffiliateSubId(firstParam(params.source)) ?? "organic_search";
  const availableDestinations = new Set(
    plans.flatMap((plan) => (isAffiliateLinkAvailable(plan.destination, source) ? [plan.destination] : []))
  );

  return (
    <main className="agency-guide">
      <header className="agency-hero">
        <div>
          <p className="eyebrow">PayMatch field guide</p>
          <h1>HighLevel for agencies</h1>
          <p className="subcopy">
            Choose the plan that matches the agency you operate now. The main decision is how many client accounts
            you need and whether you plan to resell software access.
          </p>
        </div>
        <ShieldCheck size={34} aria-hidden="true" />
      </header>

      <section className="agency-checklist" aria-labelledby="setup-heading">
        <div>
          <p className="eyebrow">Before subscribing</p>
          <h2 id="setup-heading">A short implementation check</h2>
        </div>
        <ul>
          <li><Check size={17} aria-hidden="true" /> List the client workflows you will actually automate.</li>
          <li><Check size={17} aria-hidden="true" /> Count the sub-accounts you need during the next six months.</li>
          <li><Check size={17} aria-hidden="true" /> Choose Agency Pro only when SaaS resale is part of the plan.</li>
        </ul>
      </section>

      <section className="affiliate-disclosure" aria-label="Affiliate disclosure">
        <CircleDollarSign size={20} aria-hidden="true" />
        <div>
          <strong>Affiliate disclosure</strong>
          <p>
            When a referral button is available and you subscribe through it, Radom UG may receive a commission from
            HighLevel at no additional cost to you. Our plan comparison is based on product fit, not commission size.
          </p>
        </div>
      </section>

      <section className="plan-grid" aria-label="HighLevel plan comparison">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.destination}>
            <div>
              <h2>{plan.name}</h2>
              <strong className="plan-price">{plan.price}</strong>
              <p>{plan.bestFor}</p>
            </div>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            {!isInstalledCustomer && availableDestinations.has(plan.destination) ? (
              <a className="primary-link" href={`/go/highlevel/${plan.destination}?source=${source}`}>
                Start with HighLevel <ArrowRight size={16} aria-hidden="true" />
              </a>
            ) : null}
          </article>
        ))}
      </section>

      {isInstalledCustomer ? (
        <p className="agency-status">Manage your existing subscription inside HighLevel. This guide does not show referral links to installed customers.</p>
      ) : availableDestinations.size === 0 ? (
        <p className="agency-status">The verified referral link is temporarily unavailable. The comparison remains available while we restore it.</p>
      ) : null}
    </main>
  );
}

function isAffiliateLinkAvailable(destination: AffiliateDestination, source: AffiliateSubId): boolean {
  try {
    affiliateUrl(destination, source);
    return true;
  } catch {
    return false;
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
