import { predictProteinStructure } from '../utils/coordinate_generator.js';
import { supabase, getUserFromAuth } from '../utils/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  try {
    const { sequence } = req.body || {};
    if (!sequence) return res.status(400).json({ status: 'error', message: 'Sequence is required' });

    const maxLen = 10000;
    const minLen = 2;

    if (sequence.length < minLen) {
      return res.status(400).json({ status: 'error', message: `Sequence too short. Min is ${minLen}` });
    }
    if (sequence.length > maxLen) {
      return res.status(400).json({ status: 'error', message: `Sequence too long. Max is ${maxLen}` });
    }

    if (!/^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(sequence)) {
      return res.status(400).json({ status: 'error', message: 'Invalid amino acids' });
    }

    const cleanSeq = sequence.toUpperCase();
    const user = await getUserFromAuth(req);

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Authenticated user required' });
    }

    // Check cache
    const { data: cached } = await supabase
      .from('predictions')
      .select('*')
      .eq('sequence', cleanSeq)
      .limit(1)
      .single();

    let result;
    if (cached && cached.structure_info) {
      result = {
        structure: cached.structure_info,
        coordinates: cached.coordinates,
        binding_pockets: cached.binding_pockets,
        model_source: cached.model_source || 'Cache',
      };
    } else {
      result = await predictProteinStructure(cleanSeq);
    }

    const predictionId = `pred_${Math.random().toString(36).substring(2, 14)}`;
    const timestamp = new Date().toISOString();

    const { error } = await supabase.from('predictions').insert({
      id: predictionId,
      sequence: cleanSeq,
      length: cleanSeq.length,
      structure_info: result.structure,
      coordinates: result.coordinates,
      binding_pockets: result.binding_pockets,
      model_source: result.model_source,
      user_id: user.id,
      created_at: timestamp,
      updated_at: timestamp,
    });

    if (error) {
      console.error('Supabase Insert Error:', error);
      return res.status(500).json({ status: 'error', message: `Failed to save prediction to DB: ${error.message}` });
    }

    return res.status(200).json({
      prediction_id: predictionId,
      sequence: cleanSeq,
      length: cleanSeq.length,
      ...result,
      status: 'success',
      timestamp,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}
