import { supabase, getUserFromAuth } from '../utils/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const user = await getUserFromAuth(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

  const limit = parseInt(req.query.limit) || 10;

  const { data, error } = await supabase
    .from('predictions')
    .select('id, sequence, structure_info, created_at, model_source, is_public')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ status: 'error', message: error.message });
  return res.status(200).json(data);
}
