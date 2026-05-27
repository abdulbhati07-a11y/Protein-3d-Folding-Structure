import { supabase, getUserFromAuth } from '../../utils/supabase.js';

export default async function handler(req, res) {
  const user = await getUserFromAuth(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  const { id } = req.query;

  if (req.method === 'PUT') {
    const { name, description } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return res.status(500).json({ status: 'error', message: error.message });
    return res.status(200).json({ status: 'success', project: data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ status: 'error', message: error.message });
    return res.status(200).json({ status: 'success' });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
