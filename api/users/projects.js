import { supabase, getUserFromAuth } from '../utils/supabase.js';

export default async function handler(req, res) {
  const user = await getUserFromAuth(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

  if (req.method === 'GET') {
    const limit = parseInt(req.query.limit) || 50;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return res.status(500).json({ status: 'error', message: error.message });
    return res.status(200).json({ projects: data });
  }

  if (req.method === 'POST') {
    const { name, description } = req.body || {};
    if (!name) return res.status(400).json({ status: 'error', message: 'Name is required' });

    const newProject = {
      user_id: user.id,
      name,
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (error) return res.status(500).json({ status: 'error', message: error.message });
    return res.status(201).json({ status: 'success', project: data });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
