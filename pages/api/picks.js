import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'usopen2026';

const DRAFT_SEQUENCE = [
  'Jack','Georgie','Mark','Corey','Adrian','Zach','Mike','Tomas',
  'Kollas','Kollas',
  'Tomas','Mike','Zach','Adrian','Corey','Mark','Georgie','Jack',
  'Jack','Georgie','Mark','Corey','Adrian','Zach','Mike','Tomas',
  'Kollas','Kollas',
  'Tomas','Mike','Zach','Adrian','Corey','Mark','Georgie','Jack',
  'Jack','Georgie','Mark','Corey','Adrian','Zach','Mike','Tomas',
  'Kollas','Kollas',
  'Tomas','Mike','Zach','Adrian','Corey','Mark','Georgie','Jack',
  'Jack','Georgie','Mark','Corey','Adrian','Zach','Mike','Tomas','Kollas'
];

async function loadData() {
  const picks = await redis.get('usopen-picks') || {};
  const pickLog = await redis.get('usopen-pickLog') || [];
  return { picks, pickLog };
}

async function saveData(picks, pickLog) {
  await redis.set('usopen-picks', picks);
  await redis.set('usopen-pickLog', pickLog);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const data = await loadData();
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { action, participant, golfer, password } = req.body;
    const { picks, pickLog } = await loadData();

    if (action === 'reset') {
      if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
      await saveData({}, []);
      return res.status(200).json({ success: true });
    }

    if (action === 'undo') {
      if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
      if (pickLog.length === 0) return res.status(400).json({ error: 'Nothing to undo' });
      const last = pickLog.pop();
      picks[last.player] = (picks[last.player] || []).filter(g => g !== last.golfer);
      if (picks[last.player].length === 0) delete picks[last.player];
      await saveData(picks, pickLog);
      return res.status(200).json({ success: true, picks, pickLog });
    }

    if (action === 'pick') {
      if (!participant || !golfer) return res.status(400).json({ error: 'Missing fields' });

      const currentPickNum = pickLog.length;
      if (currentPickNum >= DRAFT_SEQUENCE.length) {
        return res.status(400).json({ error: 'Draft is complete' });
      }

      const expectedPlayer = DRAFT_SEQUENCE[currentPickNum];
      if (participant !== expectedPlayer) {
        return res.status(403).json({ error: `It's ${expectedPlayer}'s turn, not ${participant}'s` });
      }

      for (const [p, golfers] of Object.entries(picks)) {
        if (golfers.includes(golfer)) {
          return res.status(409).json({ error: `${golfer} already picked by ${p}` });
        }
      }

      if (!picks[participant]) picks[participant] = [];
      picks[participant].push(golfer);
      pickLog.push({ pickNum: currentPickNum + 1, player: participant, golfer });
      await saveData(picks, pickLog);

      return res.status(200).json({
        success: true,
        picks,
        pickLog,
        pickNum: currentPickNum + 1,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  res.status(405).end();
}
