"""House-rule state machine. Decisions receive observation snapshots only."""
import random
import bot
import expert_bot as strong_bot

NAMES = ['You', 'Leo', 'Mira']
ROLES = ['King', 'Villager', 'Peasant']

def new(seed=1, round_no=1, roles=None, scores=None):
    rng = random.Random(seed)
    deck = list(bot.DECK); rng.shuffle(deck)
    hands = [deck[i*10:(i+1)*10] for i in range(3)]
    leader = next((i for i,h in enumerate(hands) if '7H' in h), None)
    fallback = leader is None
    if fallback: leader = min(range(3), key=lambda i: min(bot.DECK.index(c) for c in hands[i]))
    s = dict(seed=seed, round=round_no, hands=hands, aside=deck[30:], exposed=[], played=[], top=None,
             last=None, turn=leader, passed=[], finished=[], roles=roles, scores=scores or [0,0,0],
             phase='play' if round_no==1 else 'questions', questions=0, received=0, misses=[],
             known=[{} for _ in range(3)], log=[], events=0, original=[], fallback=fallback)
    if round_no > 1: s['turn']=roles.index('King')
    log(s, 'Round '+str(round_no)+': '+('7♥ is set aside; lowest dealt card starts.' if fallback and round_no==1 else 'Cards dealt.'))
    return s

def log(s,msg):
    s['events'] += 1; s['log'].append(msg); s['log']=s['log'][-80:]

def remember(s, observer, owner, cards):
    existing=s['known'][observer].setdefault(str(owner),[])
    for c in cards:
        if c not in existing: existing.append(c)

def observation(s,p):
    # No references to other hands or private aside cards cross this boundary.
    return dict(own_hand=list(s['hands'][p]), top=s['top'], public_cards=list(s['played']),
        opponent_counts={str(i):len(h) for i,h in enumerate(s['hands']) if i!=p},
        known_opponent_cards={i:[c for c in cards if c not in s['played'] and c not in s['exposed'] and c not in s['hands'][p]]
            for i,cards in s['known'][p].items() if int(i)!=p},
        known_removed_cards=list(s['exposed']), passed_players=[str(i) for i in s['passed']],
        removed_count=2, seed=s['seed']+s['events'])

def next_active(s,p):
    return next((j for k in range(1,4) if (j:=(p+k)%3) not in s['finished']), p)

def finish(s,p):
    if not s['hands'][p] and p not in s['finished']: s['finished'].append(p); log(s,NAMES[p]+' finished.')
    if len(s['finished'])==2:
        s['finished'].append(next(i for i in range(3) if i not in s['finished']))
        s['roles']=['']*3
        for place,i in enumerate(s['finished']):
            s['roles'][i]=ROLES[place]; s['scores'][i] += [2,1,0][place]
        s['phase']='done'; log(s, 'Round complete: '+', '.join(NAMES[i]+' — '+s['roles'][i] for i in range(3)))

def play(s,p,cards):
    if s['phase']!='play' or p!=s['turn']: raise ValueError('Wait for your turn.')
    if p in s['finished']: raise ValueError('Already finished.')
    hand=s['hands'][p]
    if not cards or len(set(cards))!=len(cards) or any(c not in hand for c in cards): raise ValueError('Select cards from your hand.')
    if len(cards)>4 or len({c[0] for c in cards})!=1: raise ValueError('Play one rank: a single, pair, triple or four-card bomb.')
    top=s['top']
    if top and len(cards)!=4 and (len(cards)!=len(top) or bot.STRENGTH[cards[0][0]]<=bot.STRENGTH[top[0][0]]):
        raise ValueError('Match the pile size with a higher rank, or play a bomb.')
    for c in cards: hand.remove(c)
    s['played'].extend(cards); s['top']=cards; s['last']=p; s['passed']=[]
    clear=len(cards)==4 or cards[0][0]=='A'
    log(s,NAMES[p]+': '+', '.join(label(c) for c in cards)+(' — BOMB! Table cleared.' if len(cards)==4 else ' — Ace clears the table.' if clear else ''))
    finish(s,p)
    if s['phase']=='done': return
    if clear:
        s['top']=None; s['turn']=p if p not in s['finished'] else next_active(s,p)
    else: s['turn']=next_active(s,p)

def pass_turn(s,p):
    if s['phase']!='play' or p!=s['turn'] or not s['top']: raise ValueError('You must lead when the table is clear.')
    s['passed'].append(p); log(s,NAMES[p]+': pass')
    challengers=[i for i in range(3) if i not in s['finished'] and i!=s['last']]
    if all(i in s['passed'] for i in challengers):
        s['turn']=s['last'] if s['last'] not in s['finished'] else next_active(s,s['last'])
        s['top']=None; s['passed']=[]; log(s,'All challengers passed. Table cleared.')
    else: s['turn']=next_active(s,p)

def label(c): return {'T':'10'}.get(c[0],c[0])+dict(C='♣',D='♦',H='♥',S='♠')[c[1]]

def exchange(s,p,action,cards=None,rank=None):
    if p!=s['turn']: raise ValueError('Wait for your turn.')
    king=s['roles'].index('King'); villager=s['roles'].index('Villager'); peasant=s['roles'].index('Peasant')
    if s['phase']=='questions' and action=='ask':
        if rank not in bot.RANKS: raise ValueError('Choose a rank.')
        hit=next((c for c in s['hands'][peasant] if c[0]==rank),None)
        s['questions']+=1
        if hit:
            s['hands'][peasant].remove(hit); s['hands'][king].append(hit); s['received']+=1
            remember(s,peasant,king,[hit]); log(s,NAMES[king]+' asks '+rank+': hit; one card transferred privately.')
        else: s['misses'].append(rank); log(s,NAMES[king]+' asks '+rank+': miss.')
        if s['questions']==3:
            s['phase']='return' if s['received'] else 'villager'
            s['turn']=king if s['received'] else villager
            if not s['received']: begin_villager(s,villager)
    elif s['phase']=='return' and action=='return':
        transfer(s,p,peasant,cards,s['received']); remember(s,king,peasant,cards)
        log(s,NAMES[king]+' returns '+str(len(cards))+' card(s) privately.')
        s['phase']='villager'; s['turn']=villager; begin_villager(s,villager)
    elif s['phase']=='villager' and action=='return':
        if not cards or len(cards)!=2 or len(set(cards))!=2 or any(c not in s['hands'][p] for c in cards): raise ValueError('Choose any two cards from your twelve-card hand to set aside.')
        for c in cards: s['hands'][p].remove(c)
        s['aside']=cards; s['exposed']=cards; log(s,NAMES[p]+' sets aside publicly: '+', '.join(label(c) for c in cards))
        s['phase']='play'; s['turn']=peasant; s['original']=[]
    else: raise ValueError('Invalid exchange action.')

def begin_villager(s,p):
    s['original']=list(s['hands'][p]); s['hands'][p].extend(s['aside']); s['aside']=[]
    log(s,NAMES[p]+' draws two private cards; choose any two cards to set aside.')

def transfer(s,p,q,cards,count):
    if cards is None or len(cards)!=count or len(set(cards))!=count or any(c not in s['hands'][p] for c in cards): raise ValueError('Select exactly '+str(count)+' cards to return.')
    for c in cards: s['hands'][p].remove(c); s['hands'][q].append(c)

def step(s):
    p=s['turn']
    if p==0 or s['phase']=='done': return
    if s['phase']=='play':
        move=strong_bot.choose_move(**observation(s,p),player=str(p),last_player=str(s['last']) if s['last'] is not None else None)
        if move: play(s,p,move)
        else: pass_turn(s,p)
    elif s['phase']=='questions':
        rank=bot.choose_rank_question(own_hand=s['hands'][p],public_cards=[],peasant_count=len(s['hands'][s['roles'].index('Peasant')]),missed_ranks=s['misses'])
        exchange(s,p,'ask',rank=rank)
    else:
        count=s['received'] if s['phase']=='return' else 2
        cards=bot.choose_cards_to_return(hand_after_receiving=s['hands'][p],count=count,eligible_return_cards=None)
        exchange(s,p,'return',cards=cards)

def view(s):
    return {k:s[k] for k in ['round','phase','turn','roles','scores','top','last','log','finished','exposed','questions','received','fallback']} | dict(
        hand=sorted(s['hands'][0],key=bot.DECK.index), counts=[len(h) for h in s['hands']],
        eligible=list(s['hands'][0]) if s['phase']=='villager' and s['turn']==0 else [],
        bombs=[r for r in bot.RANKS if sum(c[0]==r for c in s['hands'][0])==4])
