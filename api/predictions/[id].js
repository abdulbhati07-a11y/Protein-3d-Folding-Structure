import { supabase, getUserFromAuth } from '../utils/supabase.js';

export default async function handler(req, res) {
  const { id } = req.query;
  const user = await getUserFromAuth(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    if (error || !data) return res.status(404).json({ status: 'error', message: 'Not found' });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('predictions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return res.status(500).json({ status: 'error', message: error.message });
    return res.status(200).json({ status: 'success' });
  }

  if (req.method === 'PUT') {
    // This is for /share
    if (req.url.endsWith('/share')) {
      const { is_public, notes, tags } = req.body || {};
      const updates = { is_public };
      if (notes !== undefined) updates.notes = notes;
      if (tags !== undefined) updates.tags = tags;
      
      const { error } = await supabase
        .from('predictions')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) return res.status(500).json({ status: 'error', message: error.message });
      return res.status(200).json({ status: 'success' });
    }
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
