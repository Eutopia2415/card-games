"""Lead-aware opponents for the three-player 32-card shedding game.

The chooser receives only its own hand and public information. The two cards
set aside at the deal remain in the unseen pool during card-count sampling.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
from itertools import combinations
from math import comb
import random


RANKS = "789TJQKA"
SUITS = "CDHS"
DECK = tuple(r + s for r in RANKS for s in SUITS)
STRENGTH = {rank: index for index, rank in enumerate(RANKS)}


def _remove_cards(hand: Sequence[str], played: Sequence[str]) -> list[str]:
    remaining = list(hand)
    for card in played:
        remaining.remove(card)
    return remaining


def _legal_moves(hand: Sequence[str], top: Sequence[str] | None) -> list[tuple[str, ...]]:
    groups: dict[str, list[str]] = {
        rank: [card for card in hand if card[0] == rank] for rank in RANKS
    }
    moves: list[tuple[str, ...]] = []
    if top is None:
        for rank in RANKS:
            for count in range(1, len(groups[rank]) + 1):
                moves.append(tuple(groups[rank][:count]))
        return moves

    required = len(top)
    top_rank = top[0][0]
    for rank in RANKS:
        if STRENGTH[rank] > STRENGTH[top_rank] and len(groups[rank]) >= required:
            moves.append(tuple(groups[rank][:required]))
        if len(groups[rank]) == 4 and required != 4:
            moves.append(tuple(groups[rank]))  # Bombs beat any ordinary pile.
    return list(dict.fromkeys(moves))


def _can_answer(hand: Sequence[str], move: Sequence[str]) -> bool:
    if len(move) == 4 or move[0][0] == "A":
        return False  # Bombs and aces clear this table under the house rules.
    ranks = Counter(card[0] for card in hand)
    if any(amount == 4 for amount in ranks.values()):
        return True
    return any(
        STRENGTH[rank] > STRENGTH[move[0][0]] and amount >= len(move)
        for rank, amount in ranks.items()
    )


def _chance_to_hold(
    move: Sequence[str],
    own_hand: Sequence[str],
    public_cards: Sequence[str],
    opponent_counts: Mapping[str, int],
    known_opponent_cards: Mapping[str, Sequence[str]],
    known_removed_cards: Sequence[str],
    passed: set[str],
    removed_count: int,
    rng: random.Random,
    samples: int,
) -> float:
    if len(move) == 4 or move[0][0] == "A":
        return 1.0

    visible = set(public_cards)
    fixed_opponent = {
        player: remaining
        for player, cards in known_opponent_cards.items()
        if (remaining := [card for card in cards if card not in visible])
    }
    if any(player not in opponent_counts for player in fixed_opponent):
        raise ValueError("Known opponent cards need a matching opponent count")
    fixed = list(own_hand) + list(public_cards) + list(known_removed_cards)
    fixed += [card for cards in fixed_opponent.values() for card in cards]
    known = set(fixed)
    if len(known) != len(fixed) or any(card not in DECK for card in fixed):
        raise ValueError("Known cards overlap or are outside the 32-card deck")
    unseen = [card for card in DECK if card not in known]
    unknown_counts = {
        player: count - len(fixed_opponent.get(player, ()))
        for player, count in opponent_counts.items()
    }
    unknown_removed = removed_count - len(known_removed_cards)
    if min([unknown_removed, *unknown_counts.values()]) < 0:
        raise ValueError("More known cards than remaining cards")
    if len(unseen) != sum(unknown_counts.values()) + unknown_removed:
        raise ValueError("Public card counts do not match the 32-card deck")

    held = 0
    for _ in range(samples):
        shuffled = rng.sample(unseen, len(unseen))
        offset = 0
        threatened = False
        for player, count in unknown_counts.items():
            cards = fixed_opponent.get(player, []) + shuffled[offset : offset + count]
            offset += count
            if player not in passed and _can_answer(cards, move):
                threatened = True
        if not threatened:
            held += 1
    return held / samples


def _next_lead_value(remaining: Sequence[str], opponent_counts: Mapping[str, int]) -> float:
    if not remaining:
        return 10.0
    counts = Counter(card[0] for card in remaining)
    low_group = max(
        (amount for rank, amount in counts.items() if STRENGTH[rank] <= STRENGTH["J"]),
        default=0,
    )
    low_singles = sum(
        1 for rank, amount in counts.items() if amount == 1 and STRENGTH[rank] <= STRENGTH["9"]
    )
    value = 0.75 * max(0, low_group - 1) + 0.3 * low_singles
    if len(counts) == 1:
        value += 4.0  # Taking the lead sets up a finish in one play.
    if any(count <= 1 for count in opponent_counts.values()) and low_group >= 2:
        value += 2.0  # A pair/triple lead blocks a one-card opponent.
    return value


def choose_move(
    *,
    own_hand: Sequence[str],
    top: Sequence[str] | None,
    public_cards: Sequence[str],
    opponent_counts: Mapping[str, int],
    known_opponent_cards: Mapping[str, Sequence[str]] | None = None,
    known_removed_cards: Sequence[str] = (),
    passed_players: Sequence[str] = (),
    removed_count: int = 2,
    seed: int = 0,
    difficulty: str = "hard",
    personality: str = "balanced",
) -> list[str] | None:
    """Return a legal play or None for pass, without seeing hidden cards.

    Hard mode samples unknown deals to estimate whether a play wins the lead.
    The result is a calculated choice, not a perfect-information solution.
    """
    if difficulty not in {"normal", "hard"}:
        raise ValueError("difficulty must be 'normal' or 'hard'")
    if personality not in {"balanced", "aggressive", "patient"}:
        raise ValueError("personality must be balanced, aggressive, or patient")
    if top is not None and not top:
        raise ValueError("Use None for a cleared pile")
    if any(card not in DECK for card in own_hand):
        raise ValueError("Invalid card in own hand")

    rng = random.Random(seed)
    known_opponent_cards = known_opponent_cards or {}
    samples = 300 if difficulty == "hard" else 60
    moves = _legal_moves(own_hand, top)
    if not moves:
        return None

    shortest_opponent = min(opponent_counts.values(), default=10)
    behind = len(own_hand) > shortest_opponent + 2
    scored: list[tuple[float, tuple[str, ...]]] = []
    for move in moves:
        remaining = _remove_cards(own_hand, move)
        chance = _chance_to_hold(
            move, own_hand, public_cards, opponent_counts,
            known_opponent_cards, known_removed_cards,
            set(passed_players), removed_count, rng, samples,
        )
        lead_value = _next_lead_value(remaining, opponent_counts)
        rank = move[0][0]
        lead_weight = 2.1 if personality == "aggressive" else 1.5 if personality == "patient" else 1.8
        score = 1.6 * len(move) + chance * (1.2 + lead_weight * lead_value)

        # Fight for a useful next lead, especially when someone can go out soon.
        if top is not None:
            score += 0.7 * chance
        if shortest_opponent <= 2:
            score += 1.0 * chance
            if top is None and len(move) > shortest_opponent:
                score += 2.5
        if behind:
            score += 0.45 * len(move)

        # Preserve control when taking this pile would gain little.
        control_cost = 0.6 if personality == "aggressive" else 1.3 if personality == "patient" else 1.0
        if rank == "A" and remaining:
            score -= 2.0 * control_cost
            if top is not None and STRENGTH[top[0][0]] <= STRENGTH["T"]:
                if shortest_opponent > 2 and len(own_hand) > 4:
                    score -= 3.0 * control_cost
            if lead_value < 1:
                score -= 1.0 * control_cost
        elif rank == "K" and remaining:
            score -= (1.0 if lead_value < 1 else 0.5) * control_cost
        if len(move) == 4 and remaining:
            score -= 5.0 * control_cost
        if sum(card[0] == rank for card in own_hand) > len(move):
            score -= 0.5  # Small cost for breaking a set.

        if not remaining:
            score += 30.0
        if difficulty == "normal":
            score += rng.uniform(-0.4, 0.4)
        scored.append((score, move))

    scored.sort(key=lambda item: (item[0], -STRENGTH[item[1][0][0]]), reverse=True)
    best_score, best_move = scored[0]
    if top is not None:
        pass_score = (2.2 if personality == "patient" else 0.9 if personality == "aggressive" else 1.6)
        if shortest_opponent <= 2:
            pass_score -= 1.2
        if best_score < pass_score:
            return None
    return list(best_move)


def choose_rank_question(
    *,
    own_hand: Sequence[str],
    public_cards: Sequence[str],
    peasant_count: int,
    missed_ranks: Sequence[str] = (),
    known_removed_cards: Sequence[str] = (),
) -> str:
    """Pick a rank to ask for, counting a miss as a spent question.

    At an ordinary exchange there are no public plays yet. This also works if
    the house rules allow an exchange after cards have been revealed.
    """
    known = set(own_hand) | set(public_cards) | set(known_removed_cards)
    if len(known) != len(own_hand) + len(public_cards) + len(known_removed_cards):
        raise ValueError("Known cards overlap")
    unknown = [card for card in DECK if card not in known]
    if not 0 <= peasant_count <= len(unknown):
        raise ValueError("Invalid peasant hand size")
    own_counts = Counter(card[0] for card in own_hand)
    unknown_counts = Counter(card[0] for card in unknown)

    def hit_probability(rank: str) -> float:
        available = unknown_counts[rank]
        if rank in missed_ranks or available == 0:
            return 0.0
        miss = comb(len(unknown) - available, peasant_count) / comb(len(unknown), peasant_count)
        return 1.0 - miss

    def value(rank: str) -> float:
        high = {"A": 4.0, "K": 2.5, "Q": 1.7, "J": 1.2}.get(rank, 0.5)
        set_gain = {0: 0.0, 1: 1.2, 2: 2.4, 3: 5.0, 4: 0.0}[own_counts[rank]]
        return high + set_gain

    options = [rank for rank in RANKS if hit_probability(rank) > 0]
    if not options:
        raise ValueError("No rank can still be requested")
    return max(options, key=lambda rank: (hit_probability(rank) * value(rank), STRENGTH[rank]))


def choose_cards_to_return(
    *,
    hand_after_receiving: Sequence[str],
    count: int,
    eligible_return_cards: Sequence[str] | None = None,
) -> list[str]:
    """Choose exchange returns while preserving control cards and useful sets.

    The corrected Villager rule allows any two of all twelve cards. Callers
    leave eligible_return_cards unset so newly drawn cards may be discarded.
    """
    hand = list(hand_after_receiving)
    eligible = list(eligible_return_cards if eligible_return_cards is not None else hand)
    if len(set(hand)) != len(hand) or any(card not in hand for card in eligible):
        raise ValueError("Exchange cards must be unique cards in the current hand")
    if not 0 <= count <= len(eligible):
        raise ValueError("Invalid number of return cards")

    def keep_value(cards: Sequence[str]) -> float:
        ranks = Counter(card[0] for card in cards)
        score = sum({"A": 4.0, "K": 2.4, "Q": 1.4, "J": 0.8}.get(card[0], 0.1) for card in cards)
        score += sum({2: 1.5, 3: 4.0, 4: 9.0}.get(amount, 0.0) for amount in ranks.values())
        if "7H" in cards:
            score += 2.0  # The starting lead has value.
        return score

    choices = combinations(eligible, count)
    best = max(choices, key=lambda group: keep_value(_remove_cards(hand, group)))
    return list(best)
