# -*- coding: utf-8 -*-

import pandas as pd
import numpy as np
import json
 
 
def _to_json(obj):
    if isinstance(obj, float) and (np.isnan(obj) or np.isinf(obj)):
        return 0.0
    if isinstance(obj, pd.DataFrame):
        return json.loads(obj.reset_index().to_json(orient='records', date_format='iso', force_ascii=False))
    if isinstance(obj, pd.Series):
        return obj.to_dict()
    if isinstance(obj, (np.integer, np.int64)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float64)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj
