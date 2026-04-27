# -*- coding: utf-8 -*-
import pandas as pd
import traceback

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from config import SEGMENT_COLORS
from core.preprocessing import load_and_standardize, data_validation, universal_cleaner
from core.analysis import BusinessAnalyzer, data_engineering_pipeline
from ml_engine.training import train_segmentation, train_churn_model, train_sales_forecast
from core.utils import _to_json

app = Flask(__name__)
CORS(app, origins='*')

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/analyze', methods=['POST'])
def analyze():
    # CAMBIO 8 — Recepción del CSV
    if 'file' not in request.files:
        return jsonify({'error': 'No se recibió ningún archivo. Campo esperado: "file"'}), 400
    file_bytes = request.files['file'].read()
    filename   = request.files['file'].filename

    try:
        # ── Fase 1: Carga y estandarización
        df_raw = load_and_standardize(file_bytes)
        print(f"  Filas cargadas : {len(df_raw)}")
        print(f"  Columnas       : {list(df_raw.columns)}")

        # ── Fase 2: Validación de calidad 
        validation = data_validation(df_raw)
        validation['clean_rows'] = len(df_raw)   # se actualiza tras limpieza

        # ── Fase 3: Limpieza
        df_clean = universal_cleaner(df_raw)
        validation['clean_rows'] = len(df_clean)
        print(f"  Filas tras limpieza : {len(df_clean)}")

        # ── Fase 4: KPIs 
        df_for_kpis = df_raw.copy()
        df_for_kpis['date']        = pd.to_datetime(df_for_kpis['date'], errors='coerce')
        df_for_kpis['total_sales'] = pd.to_numeric(df_for_kpis['total_sales'], errors='coerce')
        df_for_kpis['profit']      = pd.to_numeric(df_for_kpis['profit'], errors='coerce')
        analyzer = BusinessAnalyzer(df_for_kpis)
        kpis     = analyzer.get_kpis()

        # ── Fase 5: Feature Engineering (RFM) 
        rfm_table = data_engineering_pipeline(df_clean)
        print(f"  Clientes únicos : {len(rfm_table)}")

        # ── Fase 6a: Segmentación KMeans 
        rfm_segmented = train_segmentation(rfm_table)

        # ── Fase 6b: Churn (Random Forest + CV) 
        churn_result  = train_churn_model(rfm_segmented)
        rfm_final     = churn_result['rfm_df']
        churn_metrics = churn_result['metrics']

        # ── Fase 6c: Forecasting 
        forecast_result = train_sales_forecast(df_clean)

# ── Fase 7: Categorías, inventario y región
        cat_analysis = analyzer.get_category_analysis().reset_index()
        inventory_data = analyzer.get_top_products(top_n=20)
        top_churn    = rfm_final.sort_values('Churn_Probability', ascending=False).head(50)

        # return jsonify() en lugar de export_results() + files.download()
        # El notebook guardaba 5 CSVs y los descargaba.
        # La API manda todo en un único JSON al dashboard.html.
        return jsonify({
            'status':   'ok',
            'filename': filename,
            'rows':     len(df_raw),

            'kpis':           {k: _to_json(v) for k, v in kpis.items()},
            'rfm_segments':   _to_json(rfm_final),
            'top_churn_risk': _to_json(top_churn),
            'forecast': {
                'method':     forecast_result['method'],
                'data':       _to_json(forecast_result['forecast_df']),
                'historical': _to_json(forecast_result['historical_df']),
            },
            'categories':    _to_json(cat_analysis),
            'inventory':     _to_json(inventory_data),
            'model_metrics': {k: _to_json(v) for k, v in churn_metrics.items()},
            'validation':    validation,
        })


    except Exception as e:
        return jsonify({'error': str(e), 'trace': traceback.format_exc()}), 500


# Aquí Flask arranca el servidor web. Gunicorn lo usa en Railway.
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=False)
