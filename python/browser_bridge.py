"""Browser-worker controller. Network clients receive per-seat views only."""
import json
import game
import bot

state = None
humans = [0]
names = ['You', 'Leo', 'Mira']
revision = 0

def _view(p):
    v = game.view(state)
    v.update(hand=sorted(state['hands'][p], key=bot.DECK.index),
        eligible=list(state['hands'][p]) if state['phase']=='villager' and state['turn']==p else [],
        bombs=[r for r in bot.RANKS if sum(c[0]==r for c in state['hands'][p])==4],
        player=p, names=names, humans=humans, revision=revision)
    return v

def _valid_saved(s):
    try:
        cards=sum(s['hands'], [])+s['aside']+s['played']
        return len(cards)==32 and set(cards)==set(bot.DECK) and s['phase'] in {'play','questions','return','villager','done'} and s['turn'] in range(3) and len(s['scores'])==3 and len(s['hands'])==3
    except (KeyError,TypeError): return False

def handle(raw):
    global state, humans, names, revision
    data=json.loads(raw)
    command=data['command']
    if command=='init':
        names=data.get('names', ['You','Leo','Mira'])
        if len(names)!=3 or any(not isinstance(n,str) or len(n)>24 for n in names): raise ValueError('Invalid player names.')
        humans=data.get('humans',[0])
        if 0 not in humans or any(p not in range(3) for p in humans): raise ValueError('Invalid seats.')
        game.NAMES=names
        saved=data.get('saved')
        state=json.loads(json.dumps(saved)) if saved and _valid_saved(saved) else game.new(data['seed'])
        revision+=1
    elif command=='seats':
        if state is None: raise ValueError('Game is loading.')
        humans=data['humans'];names=data['names'];game.NAMES=names
        revision+=1
    elif command=='action':
        p=data['player'];a=data['action']
        if p not in humans: raise ValueError('This seat is controlled by a bot.')
        candidate=json.loads(json.dumps(state))
        if a in {'new','next'} and p!=0: raise ValueError('Only the host can start rounds.')
        if a=='new': candidate=game.new(data['seed'])
        elif a=='next':
            if candidate['phase']!='done': raise ValueError('Finish this round first.')
            candidate=game.new(candidate['seed']+1,candidate['round']+1,candidate['roles'],candidate['scores'])
        elif candidate['phase'] in {'questions','return','villager'}:
            game.exchange(candidate,p,a,data.get('cards'),data.get('rank'))
        elif a=='play': game.play(candidate,p,data.get('cards',[]))
        elif a=='pass': game.pass_turn(candidate,p)
        else: raise ValueError('Unknown action.')
        state=candidate;revision+=1
    elif command=='step':
        if state['phase']!='done' and state['turn'] not in humans:
            candidate=json.loads(json.dumps(state));game.step(candidate);state=candidate;revision+=1
    elif command!='view': raise ValueError('Unknown command.')
    # Full snapshots are used only for local solo persistence, never sent to peers.
    result={'views':[_view(p) for p in range(3)]}
    if data.get('solo'): result['saved']=state
    return json.dumps(result)
