# -*- coding: utf-8 -*-

#Carga, validación y limpieza de datos

import pandas as pd
import numpy as np
import io
import json
import ollama
from config import STANDARD_COLUMNS

def llm_map_columns(headers, sample_rows, max_retries=2):
    """Usa un LLM para mapear columnas de un CSV a un esquema estándar usando similitud semántica y de datos."""
    prompt = f"""
Analiza los encabezados del CSV y los datos de ejemplo.

Tu tarea es mapear columnas del CSV a este esquema estándar, incluso si los nombres NO coinciden exactamente.
Debes basarte en:
1. Similitud semántica (sinónimos, abreviaciones, idiomas)
2. Patrones en los datos (fechas, números, IDs, texto categórico, etc.)

COLUMNAS ESTÁNDAR:
- customer_id: identificador único del cliente (ej: id, client_id, user, cust_no)
- date: fecha (ej: order_date, fecha, timestamp)
- total_sales: importe total (ej: revenue, sales, amount, total)
- product_category: categoría (ej: category, type, family)
- product_name: nombre del producto (ej: product, item, description)
- region: ubicación (ej: city, country, region, location)
- profit: beneficio (ej: profit, margin, gain)

Reglas:
- Puedes asignar aunque el nombre sea diferente si el significado o los datos coinciden.
- Usa los datos de ejemplo para confirmar (fechas, números, textos).
- Si no estás razonablemente seguro, usa null.
- No inventes columnas.

CSV HEADERS: {headers}
SAMPLE DATA: {sample_rows}

Responde SOLO con JSON válido en este formato:
{{"customer_id": "columna_csv", "date": null, ...}}
"""
    
    try:
        response = ollama.chat(
            model='llama3.1:8b', 
            messages=[{'role': 'user', 'content': prompt}]
        )
        mapping_str = response['message']['content'].strip()
        
        if '```json' in mapping_str:
            mapping_str = mapping_str.split('```json')[1].split('```')[0]
        elif '```' in mapping_str:
            mapping_str = mapping_str.split('```')[1]
            
        mapping = json.loads(mapping_str)
        return {k: v for k, v in mapping.items() if v and v != 'null'}
    except Exception as e:
        print(f"LLM mapping failed: {e}")
        return {}

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

    # 5. Fechas inválidas (esto dio varios fallos)
    if 'date' in df.columns:
        # 1. Convertimos la columna al formato de fecha correcto (DD/MM/YYYY)
        # y guardamos el resultado en el dataframe
        df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors='coerce')
        
        # 2. Ahora contamos si ha quedado alguna fecha verdaderamente inválida
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

def load_and_standardize(uploaded_file):
    df = pd.read_csv(io.BytesIO(uploaded_file), encoding='latin-1')

    # Eliminar columnas duplicadas físicas
    df = df.loc[:, ~df.columns.duplicated()].copy()

    # Normalizar nombres: minúsculas, quitar espacios y reemplazar ESPACIOS Y GUIONES por '_'
    df.columns = [c.lower().strip().replace(' ', '_').replace('-', '_') for c in df.columns]
    print(f"Columnas detectadas: {list(df.columns)}")

    headers = list(df.columns)
    sample_df = df.head(3)
    sample_rows = sample_df.to_csv(index=False, header=False) if not sample_df.empty else ""
    
    col_mapping = llm_map_columns(headers, sample_rows)
    print(f"LLM Mapping: {col_mapping}")
    
    # Fallback si el LLM no puede mapear al menos 3 columnas
    if len([v for v in col_mapping.values() if v]) < 3:
        print("LLM insufficient, using traditional synonyms.")
        synonyms = {
            'customer_id': ['customer_id', 'id_cliente', 'userid', 'client', 'customer_name'],
            'date': ['order_date', 'fecha', 'timestamp', 'date'],
            'total_sales': ['sales', 'ventas', 'amount', 'ingresos', 'total'],
            'product_category': ['category', 'categoria', 'product_category', 'clase', 'familia'],
            'product_name': ['product_name', 'product', 'item', 'sub_category', 'sub_categoria', 'nombre_producto'],
            'region': ['region', 'ciudad', 'city', 'country', 'state'],
            'profit': ['profit', 'beneficio', 'gain', 'margin']
        }
        for std_col, syns in synonyms.items():
            matched = [col for col in df.columns if any(syn in col for syn in syns)]
            if matched:
                col_mapping[std_col] = matched[0]
    
    # Solo asignamos las columnas que el LLM ha identificado
    df_std = pd.DataFrame()
    for std_col, csv_col in col_mapping.items():
        if csv_col in df.columns:
            if std_col in ['total_sales', 'profit']:
                df_std[std_col] = pd.to_numeric(df[csv_col], errors='coerce')
            else:
                df_std[std_col] = df[csv_col]
    
    # Si el LLM no ha podido mapear alguna columna estándar, la creamos vacía o con valores por defecto
    for std_col in STANDARD_COLUMNS:
        if std_col not in df_std.columns:
            print(f"Filling missing '{std_col}'")
            if std_col == 'profit' and 'total_sales' in df_std.columns:
                df_std[std_col] = df_std['total_sales'] * 0.15
            elif std_col in ['total_sales', 'profit']:
                df_std[std_col] = 0.0
            elif std_col == 'date':
                df_std[std_col] = pd.NaT
            else:
                df_std[std_col] = np.nan

    if 'date' in df_std.columns and not df_std['date'].isnull().all():
        df_std['date'] = pd.to_datetime(df_std['date'], dayfirst=True, errors='coerce')
        
        # Opcional: eliminar las filas que sean realmente invalidas
        df_std = df_std.dropna(subset=['date'])

    return df_std.copy()


def universal_cleaner(df):
    # 1. Limpieza de Fechas
    df['date'] = pd.to_datetime(df['date'], errors='coerce')

    # 2. Limpieza de Números y manejo de Nulos Críticos 
    for col in ['total_sales', 'profit']:
        if col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.replace(r'[^\d.]', '', regex=True)
            df[col] = pd.to_numeric(df[col], errors='coerce')
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val).astype(float)

    # 3. Encoding de Categorías (One-Hot Encoding)
    # Creamos variables dummies para que el modelo entienda qué categorías compra cada cliente
    if 'product_category' in df.columns:
        df = pd.get_dummies(df, columns=['product_category'], prefix='cat')

    # Eliminar filas sin ID o fecha
    df = df.dropna(subset=['customer_id', 'date'])
    return df