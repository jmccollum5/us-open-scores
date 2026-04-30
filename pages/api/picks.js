// pages/api/picks.js
import fs from 'fs';

const DATA_FILE = '/tmp/picks-pga.json';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pga2025';

const DRAFT_SEQUENCE = [
  'Mike','Kollas','Georgie','Corey','Zach','Tomas','Mark','Adrian',
  'Jack','Jack',
  'Adrian','Mark','Tomas','Zach','Corey','Georgie','Kollas','Mike',
  'Mike','Kollas','Georgie','Corey','Zach','Tomas','Mark','Adrian',
  'Jack','Jack',
  'Adrian','Mark','Tomas','Zach','Corey','Georgie','Kollas','Mike',
  'Mike','Kollas','Georgie','Corey','Zach','Tomas','Mark','Adrian',
  'Jack','Jack',
  'Adrian','Mark','Tomas','Zach','Corey','Georgie','Kollas','Mike',
  'Mike','Kollas','Georgie','Corey','Zach','Tomas','Mark','Adrian','Jack'
];

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { picks: {}, pickLog: [] };
}

function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data)); } catch (e) {}
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(loadData());
  }

  if (req.method === 'POST') {
    const { action, participant, golfer, password } = req.body;
    const data = loadData();

    if (action === 'reset') {
      if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
      saveData({ picks: {}, pickLog: [] });
      return res.status(200).json({ success: true });
    }

    if (action === 'undo') {
      if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Wrong password' });
      if (data.pickLog.length === 0) return res.status(400).json({ error: 'Nothing to undo' });
      const last = data.pickLog.pop();
      data.picks[last.player] = (data.picks[last.player] || []).filter(g => g !== last.golfer);
      if (data.picks[last.player].length === 0) delete data.picks[last.player];
      saveData(data);
      return res.status(200).json({ success: true, picks: data.picks, pickLog: data.pickLog });
    }

    if (action === 'pick') {
      if (!participant || !golfer) return res.status(400).json({ error: 'Missing fields' });

      const currentPickNum = data.pickLog.length;
      if (currentPickNum >= DRAFT_SEQUENCE.length) {
        return res.status(400).json({ error: 'Draft is complete' });
      }

      const expectedPlayer = DRAFT_SEQUENCE[currentPickNum];
      if (participant !== expectedPlayer) {
        return res.status(403).json({ error: `It's ${expectedPlayer}'s turn, not ${participant}'s` });
      }

      for (const [p, golfers] of Object.entries(data.picks)) {
        if (golfers.includes(golfer)) {
          return res.status(409).json({ error: `${golfer} already picked by ${p}` });
        }
      }

      if (!data.picks[participant]) data.picks[participant] = [];
      data.picks[participant].push(golfer);
      data.pickLog.push({ pickNum: currentPickNum + 1, player: participant, golfer });
      saveData(data);

      return res.status(200).json({
        success: true,
        picks: data.picks,
        pickLog: data.pickLog,
        pickNum: currentPickNum + 1,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  res.status(405).end();
}
