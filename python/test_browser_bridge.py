import unittest,json
import browser_bridge as bridge
import game,bot

class BrowserBridgeTests(unittest.TestCase):
    def call(self,**kw): return json.loads(bridge.handle(json.dumps(kw)))
    def start(self,humans=[0,1,2]):return self.call(command='init',seed=17,humans=humans,names=['Host','Alice','Bob'])
    def test_private_views(self):
        r=self.start()
        for p,v in enumerate(r['views']):
            self.assertEqual(v['hand'],sorted(bridge.state['hands'][p],key=bot.DECK.index));self.assertEqual(v['player'],p)
            self.assertNotIn('hands',v);self.assertNotIn('aside',v);self.assertNotIn('seed',v)
        self.assertNotIn('saved',r)
    def test_illegal_action_is_atomic_and_cannot_spoof_seat(self):
        r=self.start();p=bridge.state['turn'];before=json.dumps(bridge.state)
        with self.assertRaises(ValueError):self.call(command='action',player=p,action='play',cards=bridge.state['hands'][(p+1)%3][:1])
        self.assertEqual(json.dumps(bridge.state),before)
        with self.assertRaises(ValueError):self.call(command='action',player=1,action='new',seed=2)
    def test_humans_are_not_automatically_played(self):
        self.start();before=json.dumps(bridge.state);self.call(command='step');self.assertEqual(json.dumps(bridge.state),before)
    def test_full_human_round_and_next_round(self):
        self.start()
        for _ in range(300):
            if bridge.state['phase']=='done':break
            p=bridge.state['turn'];moves=bot._legal_moves(bridge.state['hands'][p],bridge.state['top']);cards=list(moves[0]) if moves else None
            self.call(command='action',player=p,action='play' if cards else 'pass',cards=cards)
            all_cards=sum(bridge.state['hands'],[])+bridge.state['aside']+bridge.state['played'];self.assertEqual(set(all_cards),set(bot.DECK));self.assertEqual(len(all_cards),32)
        self.assertEqual(bridge.state['phase'],'done')
        with self.assertRaises(ValueError):self.call(command='action',player=2,action='next')
        self.call(command='action',player=0,action='next');self.assertEqual(bridge.state['round'],2);self.assertEqual(bridge.state['phase'],'questions')
    def test_villager_can_discard_drawn_cards_in_any_seat(self):
        for villager in range(3):
            self.start();roles=['King','Peasant','Peasant'];roles[villager]='Villager';king=next(p for p in range(3) if p!=villager);roles[king]='King';peasant=next(p for p in range(3) if p not in (villager,king));roles[peasant]='Peasant'
            s=game.new(9,2,roles);game.begin_villager(s,villager);s['phase']='villager';s['turn']=villager;drawn=s['hands'][villager][-2:]
            result=self.call(command='init',seed=1,saved=s,humans=[0,1,2],names=['Host','Alice','Bob']);self.assertEqual(len(result['views'][villager]['eligible']),12)
            result=self.call(command='action',player=villager,action='return',cards=drawn);self.assertEqual(result['views'][villager]['counts'][villager],10);self.assertEqual(result['views'][0]['exposed'],drawn)
    def test_solo_restore_and_multiplayer_no_snapshot(self):
        first=self.call(command='init',seed=33,solo=True);saved=first['saved'];r=self.call(command='init',seed=99,saved=saved,solo=True);self.assertEqual(saved,r['saved'])
        self.assertNotIn('saved',self.call(command='view'))

    def test_animation_cues_only_reveal_public_plays(self):
        result=self.start();self.assertEqual(result['views'][0]['events'],[{'kind':'deal'}])
        p=bridge.state['turn'];card=bridge.state['hands'][p][0]
        result=self.call(command='action',player=p,action='play',cards=[card])
        for v in result['views']:
            self.assertEqual(v['events'][0]['cards'],[card]);self.assertEqual(v['events'][0]['player'],p)
            self.assertEqual(v['events'][0]['kind'],'play')
        self.assertEqual(result['views'][0]['events'][0]['cleared'],card[0]=='A')

    def test_private_exchange_cues_contain_counts_only(self):
        self.start();s=game.new(17,2,['King','Villager','Peasant'])
        self.call(command='init',seed=1,saved=s,humans=[0,1,2])
        rank=bridge.state['hands'][2][0][0]
        result=self.call(command='action',player=0,action='ask',rank=rank)
        for v in result['views']:
            self.assertEqual(v['events'],[{'kind':'transfer','source':2,'player':0,'count':1}])
        # A third question can both transfer privately and deal the two aside cards.
        bridge.state['questions']=2;bridge.state['received']=0
        absent=next(r for r in bot.RANKS if not any(c[0]==r for c in bridge.state['hands'][2]))
        result=self.call(command='action',player=0,action='ask',rank=absent)
        for v in result['views']:self.assertEqual(v['events'],[{'kind':'draw','player':1,'count':2}])
        self.assertEqual(len(result['views'][1]['hand']),12)

    def test_ace_and_bomb_clear_cues(self):
        for bomb in [False,True]:
            self.start();s=bridge.state;p=s['turn']
            cards=['7C','7D','7H','7S'] if bomb else ['AC']
            for c in cards:
                for h in s['hands']:
                    if c in h:h.remove(c)
                if c in s['aside']:s['aside'].remove(c)
                s['hands'][p].append(c)
            result=self.call(command='action',player=p,action='play',cards=cards)
            self.assertTrue(result['views'][0]['events'][0]['cleared']);self.assertIsNone(result['views'][0]['top'])
            self.assertEqual(result['views'][0]['events'][0]['cards'],cards)

if __name__=='__main__':unittest.main()
