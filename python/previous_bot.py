"""Observation-only information-set rollouts for three-player practice.

Samples possible unseen deals, never receives the actual opposing hands.
Every candidate is evaluated on the same sampled worlds. Probabilities are
planning estimates, not claims about a player's real hidden cards.
"""
from __future__ import annotations
from collections import Counter
import random
import bot


def _policy(hand, top, counts, rng):
    moves=bot._legal_moves(hand,top)
    if not moves: return None
    for move in moves:
        if len(move)==len(hand): return list(move)
    shortest=min((n for n in counts if n>0),default=10)
    groups=Counter(c[0] for c in hand)
    def value(move):
        rank=move[0][0]; n=len(move)
        score=2.3*n-.24*bot.STRENGTH[rank]
        if groups[rank]>n: score-=1.8 # Keep useful pairs/triples intact.
        if rank=='A': score-=3.6*n # Each ace can recover a separate lead.
        if n==4: score-=5.0 # Preserve a bomb while ordinary shedding is possible.
        if top is not None and shortest<=2:
            score+=4.0 if rank=='A' or n==4 else 2.0
        if top is None and n>shortest: score+=1.8
        return score+rng.uniform(-.25,.25)
    best=max(moves,key=value)
    if top and value(best)<-.3 and shortest>2: return None
    return list(best)


def _advance(hands,turn,top,last,passed,finished,move):
    if move:
        for c in move: hands[turn].remove(c)
        top=move;last=turn;passed=set()
        if not hands[turn]: finished.append(turn)
        if len(move)==4 or move[0][0]=='A':
            top=None
            if hands[turn]: return turn,top,last,passed,finished
    else:
        passed.add(turn)
        challengers=[p for p,h in hands.items() if h and p!=last]
        if all(p in passed for p in challengers):
            top=None;passed=set()
            if hands[last]: return last,top,last,passed,finished
            turn=last
    order=list(hands)
    at=order.index(turn)
    nxt=next((order[(at+k)%len(order)] for k in range(1,len(order)+1) if hands[order[(at+k)%len(order)]]),turn)
    return nxt,top,last,passed,finished


def choose_move(*,own_hand,top,public_cards,opponent_counts,known_opponent_cards=None,
                known_removed_cards=(),passed_players=(),removed_count=2,seed=0,
                player='0',last_player=None,samples=48):
    moves=bot._legal_moves(own_hand,top)
    if not moves: return None
    for move in moves:
        if len(move)==len(own_hand): return list(move)
    if len(moves)==1 and top is None: return list(moves[0])
    candidates=[list(m) for m in moves]+([None] if top else [])
    rng=random.Random(seed)
    known_opponent_cards=known_opponent_cards or {}
    visible=set(public_cards)|set(known_removed_cards)|set(own_hand)
    fixed={p:[c for c in known_opponent_cards.get(p,[]) if c not in visible] for p in opponent_counts}
    all_known=list(own_hand)+list(public_cards)+list(known_removed_cards)+sum(fixed.values(),[])
    if len(set(all_known))!=len(all_known) or any(c not in bot.DECK for c in all_known): raise ValueError('Overlapping or invalid known cards')
    unknown_counts={p:n-len(fixed[p]) for p,n in opponent_counts.items()}
    unknown_aside=removed_count-len(known_removed_cards)
    unseen=[c for c in bot.DECK if c not in all_known]
    if min([unknown_aside,*unknown_counts.values()])<0 or len(unseen)!=sum(unknown_counts.values())+unknown_aside: raise ValueError('Observation counts do not conserve cards')
    order=sorted([player,*opponent_counts],key=int)
    totals=[0.0]*len(candidates)
    for sample in range(samples):
        shuffled=rng.sample(unseen,len(unseen));offset=0;world={player:list(own_hand)}
        for p,n in unknown_counts.items(): world[p]=fixed[p]+shuffled[offset:offset+n];offset+=n
        world={p:world[p] for p in order}
        for idx,move in enumerate(candidates):
            hands={p:list(h) for p,h in world.items()}; finished=[]
            turn,pile,last,passed,finished=_advance(hands,player,list(top) if top else None,last_player,set(passed_players),finished,move)
            rollout_rng=random.Random(seed+sample*7919)
            for _ in range(160):
                if player in finished or sum(bool(h) for h in hands.values())<=1: break
                action=_policy(hands[turn],pile,[len(h) for p,h in hands.items() if p!=turn],rollout_rng)
                turn,pile,last,passed,finished=_advance(hands,turn,pile,last,passed,finished,action)
            place=finished.index(player) if player in finished else len(finished)
            totals[idx]+=[1.0,.25,0.0][min(place,2)]
    # Tiny public-only tie-break favors shedding low sets while retaining control.
    groups=Counter(c[0] for c in own_hand)
    def score(idx):
        move=candidates[idx]
        tie=0 if move is None else .003*len(move)-.0002*bot.STRENGTH[move[0][0]]-.004*(move[0][0]=='A')-.002*(len(move)==4)-.002*(groups[move[0][0]]>len(move))
        return totals[idx]/samples+tie
    return candidates[max(range(len(candidates)),key=score)]
