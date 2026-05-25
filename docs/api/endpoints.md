# API Endpoints Specification

## 1. Predictions Blueprint

### POST `/api/predictions/predict`
Predict protein structure from amino acid sequence.

**Request Body:**
```json
{
  "sequence": "MKFLKFSLLTAVLLSVV"
}
```

**Response:**
```json
{
  "prediction_id": "pred_abc123def456",
  "sequence": "MKFLKFSLLTAVLLSVV",
  "length": 17,
  "structure": {
    "atoms": 17,
    "residues": 17,
    "confidence": 0.87,
    "secondary_structure": "HHHHHHHHHHHHHHHHH",
    "description": "Mock structure (Helix)"
  },
  "coordinates": [
    {
      "x": 5.0,
      "y": 0.0,
      "z": 0.0,
      "atom_type": "CA",
      "element": "C",
      "residue_idx": 0,
      "residue": "M",
      "b_factor": 0.85
    },
    ...
  ],
  "model_source": "esmfold",
  "status": "success",
  "timestamp": "2026-05-17T16:21:06Z"
}
```

## 2. Health Blueprint

### GET `/api/health`
Get system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-17T16:20:31Z",
  "version": "1.0.0",
  "components": {
    "esmfold": "simulated",
    "database": "connected",
    "supabase": "configured",
    "cache": "healthy",
    "gpu": "not available"
  },
  "metrics": {
    "predictions_cached": 0,
    "cache_size_mb": 0,
    "avg_prediction_time": 0,
    "requests_per_minute": 0
  }
}
```
