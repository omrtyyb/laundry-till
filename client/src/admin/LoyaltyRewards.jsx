// Admin "Loyalty rewards": set a reward for each kind of ticket, e.g. every 10th dry cleaning
// ticket gets 20% off. The till offers the reward when it's due on a new ticket, and the worker
// chooses whether to give it (see till/LoyaltyOffer.jsx and server/lib/loyalty.js).

import { useEffect, useState } from "react";
import { showToast } from "../utils/toast.js";
import { loadJson, request } from "../utils/api.js";
import { ordinal } from "../utils/ordinal.js";

const KINDS = [
  { kind: "dryCleaning", label: "Dry cleaning" },
  { kind: "serviceWash", label: "Service wash" },
];

const PERCENT_CHOICES = [5, 10, 15, 20, 25, 50];

export default function LoyaltyRewards() {
  const [rules, setRules] = useState(null);

  useEffect(() => {
    loadJson("/api/admin/loyalty")
      .then(setRules);
  }, []);

  if (rules === null) return <p>Loading…</p>;

  return (
    <section className="report">
      <h2>Loyalty rewards</h2>
      <p className="report-note">
        Reward regular customers with money off every so many tickets. When a customer's reward is
        due, the till shows it on their new ticket and the worker chooses whether to give it. If it
        isn't given, it stays due on their next ticket. Tickets with the same phone number count as
        one customer, and cancelled tickets don't count.
      </p>
      <div className="loyalty-rules">
        {KINDS.map(({ kind, label }) => (
          <RuleForm
            key={kind}
            kind={kind}
            label={label}
            rule={rules[kind]}
            onSaved={(rule) => setRules({ ...rules, [kind]: rule })}
          />
        ))}
      </div>
    </section>
  );
}

function RuleForm({ kind, label, rule, onSaved }) {
  const [every, setEvery] = useState(String(rule?.every ?? 10));
  const [percent, setPercent] = useState(String(rule?.percent ?? 10));
  const [active, setActive] = useState(Boolean(rule?.active));

  const changed =
    !rule ||
    Number(every) !== rule.every ||
    Number(percent) !== rule.percent ||
    active !== Boolean(rule.active);

  const save = async (e) => {
    e.preventDefault();
    const { ok, data: result } = await request("/api/admin/loyalty/" + kind, {
      method: "PUT",
      body: { every: Number(every), percent: Number(percent), active },
    });
    if (!ok) return showToast(result.error, "error");
    onSaved(result);
    showToast(`${label} reward saved`);
  };

  return (
    <form className={"loyalty-rule " + kind} onSubmit={save}>
      <h3>
        <span className={"kind-tag " + kind}>{label}</span>
      </h3>
      <label className="checkbox-label">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Give a {label.toLowerCase()} reward
      </label>
      <div className={"loyalty-sentence" + (active ? "" : " off")}>
        Every
        <input
          type="number"
          min="2"
          max="1000"
          step="1"
          inputMode="numeric"
          required
          value={every}
          onChange={(e) => setEvery(e.target.value)}
        />
        tickets,
        <input
          type="number"
          min="1"
          max="100"
          step="any"
          inputMode="decimal"
          required
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
        />
        % off the last one
      </div>
      <div className="loyalty-percent-choices">
        {PERCENT_CHOICES.map((choice) => (
          <button
            type="button"
            key={choice}
            className={"sort-button" + (Number(percent) === choice ? " active" : "")}
            onClick={() => setPercent(String(choice))}
          >
            {choice}%
          </button>
        ))}
      </div>
      <p className="report-note">
        {active
          ? `A customer's ${ordinal(Number(every) || 0)} ${label.toLowerCase()} ticket gets ${Number(percent) || 0}% off, then the count starts again.`
          : "Switched off: the till won't offer this reward."}
      </p>
      <div className="form-actions">
        <button type="submit" disabled={!changed}>
          Save
        </button>
      </div>
    </form>
  );
}
