# -*- coding: utf-8 -*-
"""
config.py — Configuración global y constantes del proyecto
"""
 
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')
 
STANDARD_COLUMNS   = ['customer_id', 'date', 'total_sales', 'product_category', 'product_name', 'region', 'profit']
RFM_LOG_FEATURES   = ['Recency_log', 'Frequency_log', 'Monetary_log']
N_CLUSTERS         = 4
RANDOM_STATE       = 42
CHURN_TEST_SIZE    = 0.25
FORECAST_PERIODS   = 6
MODEL_DIR          = Path('saved_models')
 
SEGMENT_COLORS = {
    'Champions':   '#1D9E75',
    'Promising':   '#378ADD',
    'At Risk':     '#EF9F27',
    'Hibernating': '#E24B4A'
}