import { supabase, getUserFromAuth } from '../utils/supabase.js';

export default async function handler(req, res) {
  const user = await getUserFromAuth(req);
  if (!user) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') return res.status(500).json({ status: 'error', message: error.message });
    return res.status(200).json({ profile: data || { id: user.id } });
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    const updates = {
      id: user.id,
      display_name: body.display_name,
      theme: body.theme,
      bio: body.bio,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('profiles')
      .upsert(updates)
      .select()
      .single();

    if (error) return res.status(500).json({ status: 'error', message: error.message });
    return res.status(200).json({ status: 'success', profile: data });
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}
