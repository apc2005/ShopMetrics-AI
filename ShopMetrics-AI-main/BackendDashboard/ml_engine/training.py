# -*- coding: utf-8 -*-
"""
models.py — Modelos de IA: segmentación KMeans, predicción de churn y forecasting
"""

import pandas as pd
import numpy as np
import joblib

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, silhouette_score
from sklearn.pipeline import Pipeline

from config import RFM_LOG_FEATURES, N_CLUSTERS, RANDOM_STATE, CHURN_TEST_SIZE, FORECAST_PERIODS, MODEL_DIR
from prophet import Prophet


def _auto_label_clusters(rfm_df, labels):
    tmp = rfm_df.copy()
    tmp['_lbl'] = labels
    medians = tmp.groupby('_lbl')[['Recency', 'Monetary', 'Frequency']].median()
    medians['score'] = (
        medians['Recency'].rank(ascending=True) * (-1)
        + medians['Monetary'].rank(ascending=True)
        + medians['Frequency'].rank(ascending=True)
    )
    ranked = medians['score'].rank(ascending=False).astype(int)
    business_labels = ['Champions', 'Promising', 'At Risk', 'Hibernating']
    return {cluster_id: business_labels[rank - 1] for cluster_id, rank in ranked.items()}


def _save_model(obj, filename: str):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = MODEL_DIR / filename
    joblib.dump(obj, path)
    print(f"Modelo guardado en: {path}")


def train_segmentation(rfm_df):
    print(f'[Segmentación] Entrenando KMeans (k={N_CLUSTERS})…')
    features = [f for f in RFM_LOG_FEATURES if f in rfm_df.columns]
    X = rfm_df[features].fillna(0)

    scaler   = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    kmeans = KMeans(n_clusters=N_CLUSTERS, n_init=20, random_state=RANDOM_STATE)
    labels = kmeans.fit_predict(X_scaled)

    sil = silhouette_score(X_scaled, labels)
    print(f'  Silhouette Score: {sil:.4f}')

    rfm_df = rfm_df.copy()
    rfm_df['Segment_Cluster'] = labels
    rfm_df['Segment_Label']   = rfm_df['Segment_Cluster'].map(_auto_label_clusters(rfm_df, labels))
    rfm_df['Silhouette_Score'] = sil

    _save_model({'kmeans': kmeans, 'scaler': scaler}, 'segmentation_model.pkl')

    summary = (rfm_df.groupby('Segment_Label')
               [['Recency', 'Frequency', 'Monetary', 'Total_Profit']]
               .agg(['mean', 'count'])
               .round(2))
    print(summary.to_string())
    return rfm_df


def train_churn_model(rfm_df):
    print('[Churn] Entrenando modelo de predicción de abandono…')
    cat_cols    = [c for c in rfm_df.columns if c.startswith('cat_')]
    feature_cols = RFM_LOG_FEATURES + cat_cols
    feature_cols = [f for f in feature_cols if f in rfm_df.columns]

    X = rfm_df[feature_cols].fillna(0)
    y = rfm_df['Churn']

    if y.value_counts().min() < 10:
        print('Pocas muestras de la clase minoritaria.')

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=CHURN_TEST_SIZE, random_state=RANDOM_STATE, stratify=y
    )

    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('clf',    RandomForestClassifier(
            n_estimators=200, max_depth=6,
            class_weight='balanced',
            random_state=RANDOM_STATE, n_jobs=-1
        ))
    ])

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    cv_scores = cross_val_score(pipeline, X, y, cv=cv, scoring='roc_auc')
    print(f'  CV ROC-AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}')

    pipeline.fit(X_train, y_train)
    y_pred  = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    auc         = roc_auc_score(y_test, y_proba)
    report_dict = classification_report(y_test, y_pred, output_dict=True)
    cm          = confusion_matrix(y_test, y_pred).tolist()

    print(f'  ROC-AUC (test): {auc:.4f}')
    print(f'  Accuracy      : {report_dict["accuracy"]:.4f}')

    rfm_df = rfm_df.copy()
    rfm_df['Churn_Probability'] = pipeline.predict_proba(X)[:, 1]

    importances = pd.Series(
        pipeline.named_steps['clf'].feature_importances_, index=feature_cols
    ).sort_values(ascending=False)

    print('\n  --- TOP 10 VARIABLES MÁS IMPORTANTES ---')
    print(importances.head(10).to_string())

    _save_model(pipeline, 'churn_model.pkl')

    metrics = {
        'cv_roc_auc_mean':  round(float(cv_scores.mean()), 4),
        'cv_roc_auc_std':   round(float(cv_scores.std()),  4),
        'test_roc_auc':     round(float(auc), 4),
        'accuracy':         round(float(report_dict['accuracy']), 4),
        'precision_churn':  round(float(report_dict.get('1', {}).get('precision', 0)), 4),
        'recall_churn':     round(float(report_dict.get('1', {}).get('recall', 0)), 4),
        'confusion_matrix': cm,
    }

    return {'rfm_df': rfm_df, 'metrics': metrics, 'importances': importances}

print('Funciones de modelos ML listas')


# ─── FALLBACK: Regresión Polinómica ────────────────────────────────────────

def _polynomial_forecast(monthly, periods):
    """Fallback: ajuste polinómico de grado 2 sobre el índice temporal."""
    X      = np.arange(len(monthly)).reshape(-1, 1)
    y      = monthly['y'].values
    coeffs = np.polyfit(X.flatten(), y, deg=2)
    poly   = np.poly1d(coeffs)

    future_idx   = np.arange(len(monthly), len(monthly) + periods)
    future_dates = pd.date_range(
        monthly['ds'].iloc[-1] + pd.DateOffset(months=1),
        periods=periods, freq='MS'
    )
    yhat_hist = poly(X.flatten())
    yhat_fut  = poly(future_idx)
    std_err   = np.std(y - yhat_hist)

    hist_part = pd.DataFrame({
        'ds': monthly['ds'], 'yhat': yhat_hist,
        'yhat_lower': yhat_hist - std_err, 'yhat_upper': yhat_hist + std_err
    })
    fut_part = pd.DataFrame({
        'ds': future_dates, 'yhat': yhat_fut,
        'yhat_lower': yhat_fut - std_err, 'yhat_upper': yhat_fut + std_err
    })
    return pd.concat([hist_part, fut_part], ignore_index=True), 'polynomial_regression'


# ─── FORECASTING PRINCIPAL (Prophet con fallback) ──────────────────────────

def train_sales_forecast(clean_df):
    print('[Forecast] Construyendo previsión de ventas…')

    monthly = (clean_df.groupby(clean_df['date'].dt.to_period('M'))['total_sales']
               .sum().reset_index())
    monthly.columns = ['ds', 'y']
    monthly['ds'] = monthly['ds'].dt.to_timestamp()
    monthly = monthly.sort_values('ds').reset_index(drop=True)

    historical_df = monthly.copy()

    if len(monthly) < 6:
        print('Menos de 6 meses de datos. Usando regresión polinómica.')
        result_df, method = _polynomial_forecast(monthly, FORECAST_PERIODS)
        return {'forecast_df': result_df, 'historical_df': historical_df, 'method': method}

    try:
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            uncertainty_samples=300,
        )
        model.fit(monthly)
        future   = model.make_future_dataframe(periods=FORECAST_PERIODS, freq='MS')
        forecast = model.predict(future)
        result_df = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].copy()
        # Clamp negative predictions a 0
        for col in ['yhat', 'yhat_lower', 'yhat_upper']:
            result_df[col] = result_df[col].clip(lower=0)
        method = 'prophet'
        print(f'Método: Prophet ({FORECAST_PERIODS} periodos futuros)')

    except Exception as e:
        print(f'Prophet no disponible ({e}). Usando regresión polinómica como fallback.')
        result_df, method = _polynomial_forecast(monthly, FORECAST_PERIODS)

    return {'forecast_df': result_df, 'historical_df': historical_df, 'method': method}


print('Función de forecasting lista')