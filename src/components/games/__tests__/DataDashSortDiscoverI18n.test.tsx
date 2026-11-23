import type { ComponentProps } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataDashSortDiscoverGame, {
  DATA_DASH_CARDS,
} from "../DataDashSortDiscoverGame";
import { INFER_RULE_OPTIONS } from "../dataDashAuthoring";
import type GameShell from "../shared/GameShell";
import { enTranslate } from "@/test/i18nMock";

type Call = { key: string; opts?: Record<string, unknown> };

// Every t() call is recorded. `pseudo` wraps each translated string in ⟦…⟧ so
// any visible text that did not come through t() stands out.
const state = vi.hoisted(() => ({ calls: [] as Call[], pseudo: false }));

vi.mock("react-i18next", async () => {
  const { enMock, enTranslate } = await import("@/test/i18nMock");
  const base = enMock();
  const t = (key: string, opts?: Record<string, unknown>) => {
    state.calls.push({ key, opts });
    const text = enTranslate(key, opts);
    return state.pseudo ? `⟦${text}⟧` : text;
  };
  return { ...base, useTranslation: () => ({ ...base.useTranslation(), t }) };
});

// Keep the real game; render the shell's text props and the playfield only.
vi.mock("../shared/GameShell", () => ({
  default: ({
    title,
    briefing,
    children,
    onComplete,
  }: ComponentProps<typeof GameShell>) => (
    <div>
      <h1>{title}</h1>
      <h2>{briefing?.title}</h2>
      <p>{briefing?.story}</p>
      <p>{briefing?.chapterLabel}</p>
      <ul>
        {[
          ...(briefing?.tips ?? []),
          ...(briefing?.controlInstructions?.keyboard ?? []),
          ...(briefing?.controlInstructions?.buttons ?? []),
        ].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {children({ onFinish: onComplete, reducedEffects: false })}
    </div>
  ),
}));

beforeEach(() => {
  state.calls.length = 0;
  state.pseudo = false;
});
afterEach(cleanup);

/** What the player sees for an English string under the current mode. */
const w = (english: string) => (state.pseudo ? `⟦${english}⟧` : english);

function click(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

function expectNoMissingKeys() {
  // enTranslate returns the raw key when en/common.json lacks it.
  expect(document.body.textContent).not.toContain("games.dataDash.");
}

/** Fill {{name}} from opts, the way i18next interpolates a defaultValue. */
function fill(template: string, opts: Record<string, unknown>) {
  return template.replace(/\{\{([^{}]+)\}\}/g, (_, name: string) =>
    String(opts[name]),
  );
}

function dataDashCalls() {
  return state.calls.filter((c) => c.key.startsWith("games.dataDash."));
}

/**
 * Plays the default challenge with every answer correct. `checkPhase` runs on
 * each of the three phase screens.
 */
function playDefaultChallenge(checkPhase: () => void) {
  checkPhase();
  for (const card of DATA_DASH_CARDS) {
    fireEvent.click(screen.getByText(w(card.name)).closest("button")!);
    click(w(`Place in "${w(card.sunlightNeed)}" bin`));
  }
  click(w("Submit Phase A"));

  checkPhase();
  click(w("Seed type"));
  click(w("Submit Phase B"));

  checkPhase();
  click(w("Most plants need full sunlight."));
  click(w("The full-sun bar is tallest."));
  click(w("Complete Mission"));
}

describe("Data Dash i18n (#642)", () => {
  it("default challenge requests every string through games.dataDash keys", () => {
    const complete = vi.fn();
    render(<DataDashSortDiscoverGame onComplete={complete} />);

    // Briefing and title.
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Data Dash: Sort & Discover",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your greenhouse team sent a data drop. Sort plant cards, infer hidden rules, and use chart evidence to support a claim.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Life Science Data")).toBeInTheDocument();
    expect(
      screen.getByText("Select a card, then choose a bin or answer."),
    ).toBeInTheDocument();

    // Phase A: the English is unchanged, including the space before <strong>.
    expect(screen.getByText("Phase A: Sort by Attribute")).toBeInTheDocument();
    expect(screen.getByText(/^Rule: Sort all cards by/).textContent).toBe(
      "Rule: Sort all cards by Sunlight need.",
    );
    const bean = screen.getByText("Bean").closest("button")!;
    expect(
      within(bean).getByText(
        "Bed A • Sun: full • Water: medium • Leaf: broad • Seed: pod • Growth: fast",
      ),
    ).toBeInTheDocument();
    expect(within(bean).getByText(/^Assigned bin:/).textContent).toBe(
      "Assigned bin: —",
    );
    fireEvent.click(bean);
    click('Place in "full" bin');
    expect(within(bean).getByText(/^Assigned bin:/).textContent).toBe(
      "Assigned bin: full",
    );
    expectNoMissingKeys();

    playDefaultChallenge(expectNoMissingKeys);

    // Phase B and C copy was checked by playDefaultChallenge's clicks; the
    // remaining English lines are asserted on the final screen.
    expect(screen.getByText("Phase C: Read the Chart")).toBeInTheDocument();
    expect(
      screen.getByText("Chart from your Phase A sort (Sunlight need):"),
    ).toBeInTheDocument();
    expect(screen.getByText("full: 4")).toBeInTheDocument();
    expect(screen.getByText("partial: 1")).toBeInTheDocument();
    expect(screen.getByText("shade: 3")).toBeInTheDocument();
    expect(
      screen.getByText("Which claim is best supported by the chart?"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What evidence best supports your claim?"),
    ).toBeInTheDocument();

    const keys = new Set(state.calls.map((c) => c.key));
    for (const key of [
      "title",
      "briefingStory",
      "chapterLabel",
      "tipOneAttribute",
      "tipGroupShare",
      "tipChartEvidence",
      "controlsKeyboard",
      "controlsSelect",
      "controlsEvidence",
      "phaseA",
      "phaseB",
      "phaseC",
      "sortRuleLead",
      "cardDetails",
      "assignedBin",
      "placeInBin",
      "hint",
      "submitPhaseA",
      "submitPhaseB",
      "completeMission",
      "inferPrompt",
      "groupLabel",
      "chartIntro",
      "chartRow",
      "attributes.sunlightNeed",
      "attributes.seedType",
      "values.sunlightNeed.full",
      "values.seedType.pod",
      "plants.bean",
      "plants.hosta",
      "chart.claimPrompt",
      "chart.claimFullSun",
      "chart.evidencePrompt",
      "chart.evidenceBedA",
    ]) {
      expect(keys, key).toContain(`games.dataDash.${key}`);
    }

    // The English fallback in code is the en/common.json value, not a copy
    // that can drift from it.
    for (const { key, opts } of dataDashCalls()) {
      expect(opts?.defaultValue, key).toBe(enTranslate(key));
    }

    // Translating the labels did not change scoring: all answers correct.
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({
        gameKey: "data_dash_sort_discover",
        score: 11,
        total: 11,
        accuracy: 100,
      }),
    );
  });

  it("Phase B options show attribute labels, not raw identifiers", () => {
    render(<DataDashSortDiscoverGame onComplete={() => {}} />);
    for (const card of DATA_DASH_CARDS) {
      fireEvent.click(screen.getByText(card.name).closest("button")!);
      click(`Place in "${card.sunlightNeed}" bin`);
    }
    click("Submit Phase A");

    expect(screen.getByText("Phase B: Infer the Rule")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Scientists grouped these cards with a hidden rule. Which attribute did they use?",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Group pod")).toBeInTheDocument();
    for (const label of [
      "Sunlight need",
      "Water need",
      "Seed type",
      "Growth speed",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    for (const raw of INFER_RULE_OPTIONS) {
      expect(screen.queryByRole("button", { name: raw })).toBeNull();
    }
  });

  it("authored challenge translates the derived chart question", () => {
    const complete = vi.fn();
    const challenge = {
      v: 1,
      cardIds: ["bean", "fern", "pine", "moss"],
      sortRule: "waterNeed",
      inferRule: "growthSpeed",
    };
    render(
      <DataDashSortDiscoverGame config={{ challenge }} onComplete={complete} />,
    );

    expect(screen.getByText(/^Rule: Sort all cards by/).textContent).toBe(
      "Rule: Sort all cards by Water need.",
    );
    for (const id of challenge.cardIds) {
      const card = DATA_DASH_CARDS.find((c) => c.id === id)!;
      fireEvent.click(screen.getByText(card.name).closest("button")!);
      click(`Place in "${card.waterNeed}" bin`);
    }
    click("Submit Phase A");
    expect(screen.getByText("Group slow")).toBeInTheDocument();
    click("Growth speed");
    click("Submit Phase B");

    expect(
      screen.getByText('Which "Water need" group has the most plants?'),
    ).toBeInTheDocument();
    for (const value of ["low", "medium", "high"]) {
      expect(screen.getByRole("button", { name: value })).toBeInTheDocument();
    }
    expectNoMissingKeys();
    click("high");
    click("Complete Mission");

    const prompt = state.calls.find(
      (c) => c.key === "games.dataDash.chart.mostPlantsPrompt",
    );
    expect(prompt?.opts?.rule).toBe("Water need");
    expect(state.calls.map((c) => c.key)).toContain(
      "games.dataDash.values.waterNeed.high",
    );
    // The derived prompt's defaultValue is the already-filled English; it must
    // still read the same as the en/common.json template once filled.
    for (const { key, opts = {} } of dataDashCalls()) {
      expect(fill(String(opts.defaultValue), opts), key).toBe(
        enTranslate(key, opts),
      );
    }
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ score: 6, total: 6 }),
    );
  });

  it("renders no visible text outside t() in any phase", () => {
    state.pseudo = true;
    render(<DataDashSortDiscoverGame onComplete={() => {}} />);

    // Separators the JSX keeps around translated pieces.
    const allowed = new Set(["—", "."]);
    const untranslated = new Set<string>();
    const collect = () => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent?.trim() ?? "";
        if (text && !allowed.has(text) && !/^⟦[\s\S]*⟧$/.test(text)) {
          untranslated.add(text);
        }
      }
    };

    playDefaultChallenge(collect);

    expect([...untranslated]).toEqual([]);
  });
});
