"""Exact rank-state planning in small imagined deals (never actual hidden hands)."""
from functools import lru_cache
import bot

R=bot.RANKS

def actions(hand,top):
    rank,size=top
    for r,n in enumerate(hand):
        for k in range(1,n+1):
            if size==0 or k==4 or (k==size and r>rank):yield (r,k)
    if size:yield (-1,0)

@lru_cache(maxsize=100000)
def solve(hands,turn,top,last,passed,finished):
    active=[p for p,h in enumerate(hands) if sum(h)]
    if len(active)<=1:
        order=finished+tuple(p for p in range(3) if p not in finished)
        result=[0]*3
        for place,p in enumerate(order):result[p]=(3,1,0)[place]
        return tuple(result),None
    best=None;choice=None
    for action in actions(hands[turn],top):
        r,n=action;state=list(hands);f=finished;owner=last;mask=passed;pile=top;lead=turn
        if n:
            h=list(state[turn]);h[r]-=n;state[turn]=tuple(h);owner=turn;mask=0;pile=(r,n)
            if not sum(h):f+= (turn,)
            if n==4 or r==7:pile=(-1,0)
            retain=pile[1]==0 and sum(h)>0
        else:
            mask|=1<<turn
            challengers=[p for p,h in enumerate(state) if sum(h) and p!=owner]
            cleared=all(mask&(1<<p) for p in challengers)
            if cleared:pile=(-1,0);mask=0;lead=owner
            retain=cleared and sum(state[owner])>0
        remaining=[p for p,h in enumerate(state) if sum(h)]
        nxt=lead if retain else next(((lead+k)%3 for k in range(1,4) if sum(state[(lead+k)%3])),lead)
        result,_=solve(tuple(state),nxt,pile,owner,mask,f)
        # Each simulated player maximizes its own finishing result.
        key=(result[turn],-sum(1 for v in state[turn] if v),n if r!=7 else -n,-r)
        if best is None or key>best:best=key;choice=action;out=result
    return out,choice

def choose(hands,player,top,last,passed):
    order=sorted(hands,key=int)
    state=tuple(tuple(sum(c[0]==r for c in hands[p]) for r in R) for p in order)
    turn=order.index(player);owner=order.index(last) if last is not None else turn
    pile=(R.index(top[0][0]),len(top)) if top else (-1,0)
    mask=sum(1<<order.index(p) for p in passed)
    finished=tuple(i for i,h in enumerate(state) if not sum(h))
    _,action=solve(state,turn,pile,owner,mask,finished)
    if action is None or action[1]==0:return None
    r,n=action;return [c for c in hands[player] if c[0]==R[r]][:n]
