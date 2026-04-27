# -*- coding: utf-8 -*-
"""
preprocessing.py — Carga, validación y limpieza de datos
"""

import pandas as pd
import numpy as np
import io


def data_validation(df):
    print("VALIDACIÓN DE CALIDAD DE DATOS")

    result = {}

    # 1. Filas duplicadas
    duplicates = int(df.duplicated().sum())
    print(f"Filas duplicadas: {duplicates}")
    result['duplicates'] = duplicates

    # 2. Valores nulos
    nulls = df.isnull().sum().to_dict()
    print("\nValores nulos por columna:")
    print(nulls)
    result['nulls'] = {k: int(v) for k, v in nulls.items()}

    # 3. Tipos de datos
    dtypes = df.dtypes.astype(str).to_dict()
    print("\nTipos de datos detectados:")
    print(dtypes)
    result['dtypes'] = dtypes

    # 4. Valores negativos en métricas económicas
    negatives_dict = {}
    for col in ['total_sales', 'profit']:
        if col in df.columns:
            negatives = int((df[col] < 0).sum())
            print(f"\nValores negativos en {col}: {negatives}")
            negatives_dict[col] = negatives
    result['negatives'] = negatives_dict

    # 5. Fechas inválidas
    if 'date' in df.columns:
        # 1. Convertimos la columna al formato de fecha correcto (DD/MM/YYYY)
        # y guardamos el resultado en el dataframe
        df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors='coerce')
        
        # 2. Ahora sí contamos si ha quedado alguna fecha verdaderamente inválida
        invalid_dates = int(df['date'].isnull().sum())
        
        print(f"\nFechas inválidas o no parseadas: {invalid_dates}")
        result['invalid_dates'] = invalid_dates

    # 6. Outliers simples (IQR)
    outliers_dict = {}
    for col in ['total_sales', 'profit']:
        if col in df.columns:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            outliers = df[(df[col] < Q1 - 1.5 * IQR) | (df[col] > Q3 + 1.5 * IQR)]
            outliers_count = int(len(outliers))
            print(f"\nOutliers detectados en {col}: {outliers_count}")
            outliers_dict[col] = outliers_count

    result['outliers'] = outliers_dict

    print("\nValidación completada.")

    return result


import pandas as pd
import io

def load_and_standardize(uploaded_file):
    df = pd.read_csv(io.BytesIO(uploaded_file), encoding='latin-1')

    # Eliminar columnas duplicadas físicas
    df = df.loc[:, ~df.columns.duplicated()].copy()

    # Normalizar nombres: minúsculas, quitar espacios y reemplazar ESPACIOS Y GUIONES por '_'
    # (El archivo original tiene "Sub-Category", esto previene fallos)
    df.columns = [c.lower().strip().replace(' ', '_').replace('-', '_') for c in df.columns]
    print(f"Columnas detectadas: {list(df.columns)}")

    # Sinónimos actualizados (todo con guiones bajos)
    synonyms = {
        'customer_id': ['customer_id', 'id_cliente', 'userid', 'client', 'customer_name'],
        'date': ['order_date', 'fecha', 'timestamp', 'date'],
        'total_sales': ['sales', 'ventas', 'amount', 'ingresos', 'total'],
        'product_category': ['category', 'categoria', 'product_category', 'clase', 'familia'],
        'product_name': ['product_name', 'product', 'item', 'sub_category', 'sub_categoria', 'nombre_producto'],
        'region': ['region', 'ciudad', 'city', 'country', 'state'],
        'profit': ['profit', 'beneficio', 'gain', 'margin']
    }

    # Crear dataframe estándar vacío
    df_std = pd.DataFrame()

    # Mapear columnas de forma SEGURA
    for std_col, syns in synonyms.items():
        matched_cols = [col for col in df.columns if col in syns]

        if matched_cols:
            if std_col in ['total_sales', 'profit']:
                df_std[std_col] = df[matched_cols].apply(pd.to_numeric, errors='coerce').sum(axis=1)
            else:
                df_std[std_col] = df[matched_cols[0]]
        else:
            print(f"Columna '{std_col}' no encontrada.")

            if std_col == 'profit' and 'total_sales' in df_std.columns:
                print("--> Simulando 'profit' como un margen del 15% de las ventas.")
                df_std[std_col] = df_std['total_sales'] * 0.15
            elif std_col in ['total_sales', 'profit']:
                df_std[std_col] = 0
            elif std_col == 'date':
                df_std[std_col] = pd.NaT
            else:
                df_std[std_col] = None

    if 'date' in df_std.columns and not df_std['date'].isnull().all():
        df_std['date'] = pd.to_datetime(df_std['date'], dayfirst=True, errors='coerce')
        
        # Opcional: eliminar las filas que (ahora sí) sean realmente inválidas/nulas
        df_std = df_std.dropna(subset=['date'])

    return df_std.copy()


def universal_cleaner(df):
    # 1. Limpieza de Fechas
    df['date'] = pd.to_datetime(df['date'], errors='coerce')

    # 2. Limpieza de Números y manejo de Nulos Críticos
    for col in ['total_sales', 'profit']:
        if df[col].dtype == 'object':
            df[col] = df[col].astype(str).str.replace(r'[^\d.]', '', regex=True)
        df[col] = pd.to_numeric(df[col], errors='coerce')

        # En lugar de fillna(0), usamos la mediana para no sesgar hacia abajo
        # o eliminamos si la venta es nula (dato no confiable)
        median_val = df[col].median()
        df[col] = df[col].fillna(median_val)

    # 3. Encoding de Categorías (One-Hot Encoding)
    # Creamos variables dummies para que el modelo entienda qué categorías compra cada cliente
    if 'product_category' in df.columns:
        df = pd.get_dummies(df, columns=['product_category'], prefix='cat')

    # Eliminar filas sin ID o fecha (son insalvables para series temporales/RFM)
    df = df.dropna(subset=['customer_id', 'date'])
    return df