import { supabase } from '../../utils/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });

  const limit = parseInt(req.query.limit) || 50;
  const { data, error } = await supabase
    .from('predictions')
    .select('id, sequence, created_at, tags, user_id, profiles(display_name)')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ status: 'error', message: error.message });
  
  const mapped = data.map(p => ({
    ...p,
    author_name: p.profiles?.display_name || 'Anonymous'
  }));

  return res.status(200).json({ predictions: mapped });
}
