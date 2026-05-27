import { supabase } from '../../utils/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method Not Allowed' });
  const { id } = req.query;

  const { data, error } = await supabase
    .from('predictions')
    .select('*, profiles(display_name)')
    .eq('id', id)
    .eq('is_public', true)
    .single();

  if (error || !data) return res.status(404).json({ status: 'error', message: 'Not found' });
  
  const result = { ...data, author_name: data.profiles?.display_name || 'Anonymous' };
  return res.status(200).json(result);
}
