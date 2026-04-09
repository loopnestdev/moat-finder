import { Router } from 'express';
import { adminClient } from '../services/supabase';

const router = Router();

router.get('/', async (_req, res) => {
  let checkpointsTable: string;
  try {
    const { error } = await adminClient
      .from('research_checkpoints')
      .select('id')
      .limit(1);

    if (error) {
      checkpointsTable = error.message;
    } else {
      checkpointsTable = 'ok';
    }
  } catch (err) {
    checkpointsTable = err instanceof Error ? err.message : String(err);
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    checkpoints_table: checkpointsTable,
  });
});

export default router;
