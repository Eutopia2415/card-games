"""Single-observer information-set Monte Carlo tree search.

The input is an observation only. Each iteration samples a possible unseen
deal. Tree actions maximize each simulated player's own finishing result;
actual bots do not share private hands or coordinate against the human.
"""
from __future__ import annotations
import math,random
import bot,endgame,previous_bot

class Node:
    def __init__(self):
        self.children={};self.visits=0;self.rewards=[0.,0.,0.];self.available={}

def choose_move(*,own_hand,top,public_cards,opponent_counts,known_opponent_cards=None,
                known_removed_cards=(),passed_players=(),removed_count=2,seed=0,
                player='0',last_player=None,samples=1800):
    moves=bot._legal_moves(own_hand,top)
    if not moves:return None
    for move in moves:
        if len(move)==len(own_hand):return list(move)
    if len(moves)==1 and top is None:return list(moves[0])
    known_opponent_cards=known_opponent_cards or {}
    visible=set(public_cards)|set(known_removed_cards)|set(own_hand)
    fixed={p:[c for c in known_opponent_cards.get(p,[]) if c not in visible] for p in opponent_counts}
    known=list(own_hand)+list(public_cards)+list(known_removed_cards)+sum(fixed.values(),[])
    if len(set(known))!=len(known) or any(c not in bot.DECK for c in known):raise ValueError('Overlapping or invalid known cards')
    unknown={p:n-len(fixed[p]) for p,n in opponent_counts.items()}
    unknown_aside=removed_count-len(known_removed_cards)
    unseen=[c for c in bot.DECK if c not in known]
    if min([unknown_aside,*unknown.values()])<0 or len(unseen)!=sum(unknown.values())+unknown_aside:raise ValueError('Observation counts do not conserve cards')
    order=sorted([player,*opponent_counts],key=int); rng=random.Random(seed);root=Node()
    for iteration in range(samples):
        shuffled=rng.sample(unseen,len(unseen));offset=0;hands={player:list(own_hand)}
        for p,n in unknown.items():hands[p]=fixed[p]+shuffled[offset:offset+n];offset+=n
        hands={p:hands[p] for p in order};turn=player;pile=list(top) if top else None;last=last_player;passed=set(passed_players)
        finished=[p for p,h in hands.items() if not h];node=root;path=[root];expanded=False
        for depth in range(160):
            if sum(bool(h) for h in hands.values())<=1:break
            legal=bot._legal_moves(hands[turn],pile)
            actions={(m[0][0],len(m)):list(m) for m in legal}
            if pile:actions[('',0)]=None
            if not expanded:
                for a in actions:node.available[a]=node.available.get(a,0)+1
                fresh=[a for a in actions if a not in node.children]
                if fresh:
                    a=rng.choice(fresh);child=Node();node.children[a]=child;expanded=True
                else:
                    actor=int(turn)
                    def ucb(a):
                        c=node.children[a]
                        return c.rewards[actor]/c.visits+.7*math.sqrt(math.log(node.available[a]+1)/c.visits)
                    a=max(actions,key=ucb);child=node.children[a]
                move=actions[a];node=child;path.append(node)
            else:
                if sum(map(len,hands.values()))<=7:
                    move=endgame.choose(hands,turn,pile,last,passed)
                else:
                    move=previous_bot._policy(hands[turn],pile,[len(h) for p,h in hands.items() if p!=turn],rng)
            turn,pile,last,passed,finished=previous_bot._advance(hands,turn,pile,last,passed,finished,move)
        ranking=finished+[p for p in order if p not in finished]
        reward=[0.,0.,0.]
        for place,p in enumerate(ranking):reward[int(p)]=(1.,.25,0.)[place]
        for n in path:
            n.visits+=1
            for p in range(3):n.rewards[p]+=reward[p]
    # Robust-child choice avoids chasing a lucky result from a tiny branch.
    key=max(root.children,key=lambda a:(root.children[a].visits,root.children[a].rewards[int(player)]/root.children[a].visits))
    return next((list(m) for m in moves if (m[0][0],len(m))==key),None)
