// Keep familiar game feedback separate from internal exceptions.
export function friendlyError(raw){
  const message=String(raw||'').replace(/^(?:ValueError|Error|TypeError):\s*/,'').trim();
  if(!message)return '';
  const known={
    'Play one rank: a single, pair, triple or four-card bomb.':'Those cards have different ranks. Choose matching cards for this play.',
    'Match the pile size with a higher rank, or play a bomb.':'That play doesn’t beat the cards on the table.',
    'You must lead when the table is clear.':'The table is clear. Play cards to start this turn.',
    'Wait for your turn.':'It’s someone else’s turn. Your hand will glow when you can play.',
    'Select cards from your hand.':'Choose cards from your hand first.',
    'Choose any two cards from your twelve-card hand to set aside.':'Choose exactly two cards to set aside. The drawn cards are yours to choose, too.',
    'Already finished.':'You’ve finished this round. Wait for the other players.',
    'Stale game state. Wait for an update.':'The table just changed. Wait a moment, then try again.',
    'Session changed.':'You’ve switched games. This move belongs to the previous game.',
    'Invalid game update.':'The table couldn’t update. Reload to reconnect.',
    'Invalid exchange action.':'That action isn’t available during this exchange.',
    'Finish this round first.':'Finish this round before dealing the next one.',
    'The game worker stopped. Reload to retry.':'The game stopped unexpectedly. Reload to resume your solo round.'
  };
  if(known[message])return known[message];
  if(/^Select exactly \d+ cards to return\.$/.test(message))return message.replace('Select','Choose');
  if(/Engine loading failed|Unable to load game rules/.test(message))return 'The game couldn’t load. Check your connection and reload.';
  if(/math|Traceback|Exception|Error:|division|conserve|known cards|stack|undefined|NaN/i.test(message))return 'That turn couldn’t finish. Please try again.';
  return message.length>180?'Something interrupted the game. Please try again.':message;
}
